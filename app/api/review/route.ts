import { NextResponse } from "next/server";
import { adminClient, getUser } from "../../../lib/auth";
import { runRules, type Finding } from "../../../lib/rules";
import { getAiFindings, dedupeAgainstRules } from "../../../lib/gemini-findings";
import { readPosterText } from "../../../lib/gemini-image";

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await req.json();
  const title = String(body.title || "Untitled");
  const typed = String(body.content || "").trim();
  const actor = user.email;
  const imageB64 = typeof body.image === "string" ? body.image : "";

  let bytes: Buffer | null = null;
  if (imageB64) {
    if (imageB64.length > 2500000) {
      return NextResponse.json(
        { error: "That image is too large after resizing. Try a smaller one." },
        { status: 413 }
      );
    }
    bytes = Buffer.from(imageB64, "base64");
    const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isJpeg) {
      return NextResponse.json({ error: "The image must be a JPG, PNG or WebP file." }, { status: 400 });
    }
  }

  let imageText = "";
  if (imageB64) {
    imageText = await readPosterText(imageB64);
    if (!imageText && !typed) {
      return NextResponse.json(
        { error: "No readable text was found in the poster. Type the text in the box as well." },
        { status: 422 }
      );
    }
  }

  const content = [typed, imageText].filter(Boolean).join("\n\n");
  if (!content.trim()) {
    return NextResponse.json({ error: "Content is empty." }, { status: 400 });
  }

  const db = adminClient();
  const terms = await db.from("banned_terms").select("*");
  const facts = await db.from("approved_facts").select("*");
  if (terms.error || facts.error) {
    return NextResponse.json({ error: (terms.error || facts.error)!.message }, { status: 500 });
  }

  const ruleFindings = runRules(content, terms.data ?? [], facts.data ?? []);

  // Second pass: Gemini. Never throws; returns [] on any failure (rules-only fallback).
  const aiRaw = await getAiFindings(content);
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
  const aiProvider = aiFindings.length > 0 || imageText ? "rules+gemini" : "rules-only";

  let imagePath: string | null = null;
  if (bytes) {
    imagePath = user.id + "/" + Date.now() + ".jpg";
    const up = await db.storage.from("posters").upload(imagePath, bytes, { contentType: "image/jpeg" });
    if (up.error) {
      return NextResponse.json({ error: "Could not store the poster: " + up.error.message }, { status: 500 });
    }
  }

  const saved = await db
    .from("reviews")
    .insert({
      title,
      content,
      findings,
      ai_provider: aiProvider,
      created_by: actor,
      image_path: imagePath,
      image_text: imageText || null,
    })
    .select()
    .single();
  if (saved.error) {
    return NextResponse.json({ error: saved.error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    review_id: saved.data.id,
    action: "submitted",
    actor,
    comment:
      findings.length + " findings (" + aiFindings.length + " AI-suggested)" + (imagePath ? ", with poster" : ""),
  });

  let image_url: string | null = null;
  if (imagePath) {
    const s = await db.storage.from("posters").createSignedUrl(imagePath, 3600);
    image_url = s.data?.signedUrl ?? null;
  }
  return NextResponse.json({ ...saved.data, image_url });
}
