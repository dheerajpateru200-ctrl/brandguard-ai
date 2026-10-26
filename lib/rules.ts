export type Finding = {
  quote: string;
  issue: string;
  reason: string;
  source: string;
  severity: "high" | "medium" | "low";
  confidence: number;
  suggested_fix: string;
  origin: "rules" | "ai";
};

type Term = { term: string; reason: string; suggestion: string | null; severity: string };
type Fact = { fact: string; source: string; owner: string; expires_on: string };

const STOP = new Set(["glow", "serum", "with", "that", "from", "been", "shown", "this", "have", "your", "uses", "contains"]);

function sev(s: string): "high" | "medium" | "low" {
  return s === "high" || s === "low" ? s : "medium";
}

export function runRules(content: string, terms: Term[], facts: Fact[]): Finding[] {
  const findings: Finding[] = [];
  const lower = content.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  for (const t of terms) {
    const idx = lower.indexOf(t.term.toLowerCase());
    if (idx !== -1) {
      findings.push({
        quote: content.slice(idx, idx + t.term.length),
        issue: "Banned term",
        reason: t.reason,
        source: "Brand rules: banned terms list",
        severity: sev(t.severity),
        confidence: 1,
        suggested_fix: t.suggestion ?? "Remove or rephrase this wording.",
        origin: "rules",
      });
    }
  }

  const allFacts = facts.map((f) => f.fact.replace(/\s/g, "")).join(" ");
  const matches = content.match(/\d+(\.\d+)?\s?%/g) ?? [];
  for (const m of matches) {
    const clean = m.replace(/\s/g, "");
    const alreadyFlagged = findings.some((f) => f.quote.replace(/\s/g, "") === clean);
    if (!alreadyFlagged && !allFacts.includes(clean)) {
      findings.push({
        quote: m,
        issue: "Number not in approved facts",
        reason: "This figure does not appear in the approved-fact registry, so it cannot be verified.",
        source: "Approved-fact registry",
        severity: "medium",
        confidence: 0.85,
        suggested_fix: "Remove the figure or add an approved source for it.",
        origin: "rules",
      });
    }
  }

  for (const f of facts) {
    if (f.expires_on >= today) continue;
    const tokens = f.fact
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 4 && !STOP.has(w));
    const hit = tokens.filter((w) => lower.includes(w));
    if (hit.length >= 2) {
      const idx = lower.indexOf(hit[0]);
      findings.push({
        quote: content.slice(idx, idx + hit[0].length),
        issue: "Expired fact",
        reason: "The approved fact \"" + f.fact + "\" expired on " + f.expires_on + ".",
        source: f.source + " (owner: " + f.owner + ")",
        severity: "high",
        confidence: 0.8,
        suggested_fix: "Ask " + f.owner + " to renew this fact, or remove the claim.",
        origin: "rules",
      });
    }
  }

  return findings;
}
