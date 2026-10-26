import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runRules, type Finding } from "../../../lib/rules";
import { getAiFindings, dedupeAgainstRules } from "../../../lib/gemini-findings";

export async function POST(req: Request) {
  const body = await req.json();
  const title = String(body.title || "Untitled");
  const content = String(body.content || "");
  const actor = String(body.actor || "creator");
  if (!content.trim()) {
    return NextResponse.json({ error: "Content is empty." }, { status: 400 });
  }

  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const terms = await db.from("banned_terms").select("*");
  const facts = await db.from("approved_facts").select("*");
  if (terms.error || facts.error) {
    return NextResponse.json({ error: (terms.error || facts.error)!.message }, { status: 500 });
  }

  const ruleFindings = runRules(content, terms.data ?? [], facts.data ?? []);

  // Second pass: Gemini. Never throws; returns [] on any failure (rules-only fallback).
  const aiRaw = await getAiFindings(content);
  // Rule findings carry only a quote, so locate each one in the text to compare overlaps.
  const lowerContent = content.toLowerCase();
  const ruleSpans = ruleFindings
    .map((f) => {
      const start = lowerContent.indexOf(f.quote.toLowerCase());
      return { start, end: start + f.quote.length };
    })
    .filter((s) => s.start !== -1);
  const aiFindings: Finding[] = dedupeAgainstRules(aiRaw, ruleSpans).map((f) => ({
    quote: f.phrase,
    issue: f.category === "tone" ? "AI-suggested: tone" : "AI-suggested: unsupported claim",
    reason: f.reason,
    source: "AI review (Gemini)",
    severity: f.severity,
    confidence: f.confidence,
    suggested_fix: f.suggestion || "Rephrase this wording or add supporting evidence.",
    origin: "ai",
  }));

  const findings = [...ruleFindings, ...aiFindings];
  const aiProvider = aiFindings.length > 0 ? "rules+gemini" : "rules-only";

  const saved = await db
    .from("reviews")
    .insert({ title, content, findings, ai_provider: aiProvider, created_by: actor })
    .select()
    .single();
  if (saved.error) {
    return NextResponse.json({ error: saved.error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    review_id: saved.data.id,
    action: "submitted",
    actor,
    comment: findings.length + " findings (" + aiFindings.length + " AI-suggested)",
  });

  return NextResponse.json(saved.data);
}