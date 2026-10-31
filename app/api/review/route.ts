
import { NextResponse } from "next/server";
import { adminClient, getUser } from "../../../lib/auth";
import { runRules, type Finding } from "../../../lib/rules";
import {
  getAiFindings,
  dedupeAgainstRules,
} from "../../../lib/gemini-findings";
import { analyzePoster } from "../../../lib/gemini-image";
import { getVisualFindings } from "../../../lib/visual-findings";

export async function POST(req: Request) {
  const user = await getUser(req);

  if (!user) {
    return NextResponse.json(
      { error: "Not logged in." },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const title = String(body.title || "Untitled");
  const typed = String(body.content || "").trim();
  const actor = user.email;
  const imageB64 =
    typeof body.image === "string" ? body.image : "";

  let bytes: Buffer | null = null;

  // Validate uploaded image.
  if (imageB64) {
    if (imageB64.length > 2500000) {
      return NextResponse.json(
        { error: "That image is too large after resizing. Try a smaller one." },
        { status: 413 }
      );
    }

    try {
      bytes = Buffer.from(imageB64, "base64");
    } catch {
      return NextResponse.json(
        { error: "Invalid image data." },
        { status: 400 }
      );
    }

    const isJpeg =
      bytes.length > 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;

    if (!isJpeg) {
      return NextResponse.json(
        { error: "Please upload a valid JPG/JPEG image." },
        { status: 400 }
      );
    }
  }

  // Extract poster text and regions in one Gemini request.
  let imageText = "";
  let layout: Awaited<
    ReturnType<typeof analyzePoster>
  >["regions"] = [];

  if (imageB64) {
    try {
      const posterAnalysis = await analyzePoster(imageB64);
      imageText = posterAnalysis.text.trim();
      layout = posterAnalysis.regions;
    } catch (error) {
      console.error("Poster analysis failed:", error);

      if (!typed) {
        return NextResponse.json(
          {
            error:
              "Could not analyze this poster. Gemini may be unavailable or its quota exhausted. Try again later or type the poster text manually.",
          },
          { status: 422 }
        );
      }
    }

    if (!imageText && !typed) {
      return NextResponse.json(
        {
          error:
            "No readable text was found in the poster. Try a clearer JPG or type the poster text manually.",
        },
        { status: 422 }
      );
    }
  }

  const content = [typed, imageText]
    .filter(Boolean)
    .join("\n\n");

  if (!content.trim()) {
    return NextResponse.json(
      { error: "Content is empty." },
      { status: 400 }
    );
  }

  const db = adminClient();

  // Load approved brand rules and facts.
  const terms = await db
    .from("banned_terms")
    .select("*");

  const facts = await db
    .from("approved_facts")
    .select("*");

  if (terms.error || facts.error) {
    return NextResponse.json(
      { error: (terms.error || facts.error)!.message },
      { status: 500 }
    );
  }

  // Load approved brand colours.
  const palette = await db
    .from("brand_colors")
    .select("name, hex_code");

  if (palette.error) {
    console.error(
      "Brand palette loading failed:",
      palette.error.message
    );
  }

  const approvedColors = palette.data ?? [];

  // Existing deterministic text review.
  const ruleFindings = runRules(
    content,
    terms.data ?? [],
    facts.data ?? []
  );

  // Existing Gemini text review.
  let aiFindings: Finding[] = [];

  try {
    const aiRaw = await getAiFindings(content);
    const lowerContent = content.toLowerCase();

    const ruleSpans = ruleFindings
      .map((finding) => {
        const start = lowerContent.indexOf(
          finding.quote.toLowerCase()
        );

        return {
          start,
          end: start + finding.quote.length,
        };
      })
      .filter((span) => span.start !== -1);

    aiFindings = dedupeAgainstRules(
      aiRaw,
      ruleSpans
    ).map((finding) => ({
      quote: finding.phrase,
      issue:
        finding.category === "tone"
          ? "AI-suggested: tone"
          : "AI-suggested: unsupported claim",
      reason: finding.reason,
      source: "AI review (Gemini)",
      severity: finding.severity,
      confidence: finding.confidence,
      suggested_fix:
        finding.suggestion ||
        "Rephrase this wording or add supporting evidence.",
      origin: "ai",
    }));
  } catch (error) {
    console.error("Gemini text review failed:", error);
  }

  // Visual review using detected poster regions and approved palette.
  let visualFindings: Awaited<
    ReturnType<typeof getVisualFindings>
  > = [];

  if (bytes && layout.length > 0) {
    try {
      visualFindings = await getVisualFindings(
        bytes,
        layout,
        approvedColors
      );
    } catch (error) {
      console.error(
        "Poster visual analysis failed:",
        error
      );
    }
  }

  // Combine all findings.
  const findings = [
    ...ruleFindings,
    ...aiFindings,
    ...visualFindings,
  ];

  const aiProvider =
    aiFindings.length > 0 || imageText
      ? "rules+gemini"
      : "rules-only";

  // Upload poster.
  let imagePath: string | null = null;

  if (bytes) {
    imagePath =
      user.id + "/" + Date.now() + ".jpg";

    const upload = await db.storage
      .from("posters")
      .upload(imagePath, bytes, {
        contentType: "image/jpeg",
      });

    if (upload.error) {
      return NextResponse.json(
        {
          error:
            "Could not store the poster: " +
            upload.error.message,
        },
        { status: 500 }
      );
    }
  }

  // Save review and findings, including visual regions.
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
    return NextResponse.json(
      { error: saved.error.message },
      { status: 500 }
    );
  }

  // Record audit event.
  const audit = await db.from("audit_log").insert({
    review_id: saved.data.id,
    action: "submitted",
    actor,
    comment:
      findings.length +
      " findings (" +
      aiFindings.length +
      " AI-suggested, " +
      visualFindings.length +
      " visual)" +
      (imagePath ? ", with poster" : ""),
  });

  if (audit.error) {
    console.error("Audit log insert failed:", audit.error);
  }

  // Generate temporary signed poster URL.
  let image_url: string | null = null;

  if (imagePath) {
    const signed = await db.storage
      .from("posters")
      .createSignedUrl(imagePath, 3600);

    image_url = signed.data?.signedUrl ?? null;
  }

  return NextResponse.json({
    ...saved.data,
    image_url,
  });
}
