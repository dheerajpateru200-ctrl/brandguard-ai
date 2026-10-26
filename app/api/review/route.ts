import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runRules } from "../../../lib/rules";

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

  const findings = runRules(content, terms.data ?? [], facts.data ?? []);

  const saved = await db
    .from("reviews")
    .insert({ title, content, findings, ai_provider: "rules-only", created_by: actor })
    .select()
    .single();
  if (saved.error) {
    return NextResponse.json({ error: saved.error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    review_id: saved.data.id,
    action: "submitted",
    actor,
    comment: findings.length + " findings",
  });

  return NextResponse.json(saved.data);
}
