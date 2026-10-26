// lib/geminiFindings.ts
// Second-pass AI check for BrandGuard AI. Rules run first; this adds "AI-suggested" findings.
// Never throws: on any failure it returns [] so the app falls back to rules-only.

export type AiFinding = {
  phrase: string;
  start: number; // character index in the original text
  end: number;
  category: "tone" | "unsupported_claim" | "other";
  reason: string;
  severity: "low" | "medium" | "high";
  confidence: number; // 0 to 1
  suggestion: string;
  engine: "gemini";
};

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You are a marketing compliance reviewer.
Review the marketing text and flag ONLY phrases that are:
1. "unsupported_claim": absolute or superlative claims with no evidence ("best", "guaranteed", "#1", "100% safe", "clinically proven"), or implied promises/results.
2. "tone": misleading urgency, exaggeration, or language inappropriate for a professional brand.
Rules:
- "phrase" MUST be copied exactly, character for character, from the text.
- Do not flag anything that is plainly factual and neutral.
- Return at most 6 findings. If nothing is wrong, return an empty array.
- "reason" is one sentence explaining the risk. "suggestion" is a safer rewrite of that phrase.
- "confidence" is a number from 0 to 1.`;

const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      phrase: { type: "STRING" },
      category: { type: "STRING", enum: ["tone", "unsupported_claim", "other"] },
      reason: { type: "STRING" },
      severity: { type: "STRING", enum: ["low", "medium", "high"] },
      confidence: { type: "NUMBER" },
      suggestion: { type: "STRING" },
    },
    required: ["phrase", "category", "reason", "severity", "confidence", "suggestion"],
  },
};

// Curly quotes become straight ones one-for-one, so character positions stay identical.
function normalize(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase();
}

function findPhrase(text: string, phrase: string): number {
  if (!phrase) return -1;
  const exact = text.indexOf(phrase);
  if (exact !== -1) return exact;
  return normalize(text).indexOf(normalize(phrase));
}

export async function getAiFindings(text: string): Promise<AiFinding[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !text.trim()) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: `TEXT TO REVIEW:\n"""\n${text}\n"""` }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    );
    if (!res.ok) {
      console.error("Gemini error", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const findings: AiFinding[] = [];
    for (const f of parsed) {
      // Guard against hallucinated phrases: it must exist in the original text.
      const start = findPhrase(text, f.phrase);
      if (!f.phrase || start === -1) continue;
      findings.push({
        phrase: f.phrase,
        start,
        end: start + f.phrase.length,
        category: f.category ?? "other",
        reason: String(f.reason ?? ""),
        severity: ["low", "medium", "high"].includes(f.severity) ? f.severity : "medium",
        confidence: Math.min(1, Math.max(0, Number(f.confidence) || 0.5)),
        suggestion: String(f.suggestion ?? ""),
        engine: "gemini",
      });
    }
    return findings;
  } catch (e) {
    console.error("Gemini call failed, falling back to rules only", e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Drop AI findings that overlap a phrase the rules engine already flagged.
export function dedupeAgainstRules<T extends { start: number; end: number }>(
  ai: AiFinding[],
  ruleFindings: T[]
): AiFinding[] {
  return ai.filter(
    (a) => !ruleFindings.some((r) => a.start < r.end && r.start < a.end)
  );
}

/* ---------- How to wire it in (your review API route) ----------

import { getAiFindings, dedupeAgainstRules } from "@/lib/geminiFindings";

const ruleFindings = runRules(text);                    // your existing function
const aiRaw = await getAiFindings(text);
const aiFindings = dedupeAgainstRules(aiRaw, ruleFindings);
const engine = aiRaw.length ? "rules+gemini" : "rules";  // store this on the review row

return NextResponse.json({ findings: [...ruleFindings.map(f => ({...f, engine: "rules"})), ...aiFindings], engine });

---------- Supabase SQL (run once) ----------

alter table reviews add column if not exists engine text default 'rules';
-- if you store findings in their own table:
-- alter table findings add column if not exists engine text default 'rules';

---------- .env.local (and Vercel > Settings > Environment Variables) ----------

GEMINI_API_KEY=your_key_from_aistudio.google.com
GEMINI_MODEL=gemini-2.5-flash
*/