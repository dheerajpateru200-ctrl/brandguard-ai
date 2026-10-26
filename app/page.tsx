"use client";
import { useState } from "react";

type Severity = "high" | "medium" | "low";
type Finding = {
  quote: string;
  issue: string;
  reason: string;
  source: string;
  severity: string;
  confidence: number;
  suggested_fix: string;
  origin: string;
};
type Review = { id: string; title: string; content: string; status: string; findings: Finding[] };
type Part = { text: string; sev?: Severity; idx?: number };
type SevStyle = { label: string; mark: string; bar: string; edge: string; chip: string };

const SEV: Record<Severity, SevStyle> = {
  high: {
    label: "High risk",
    mark: "bg-[#FADBD8] border-[#B42318]",
    bar: "bg-[#B42318]",
    edge: "border-l-[#B42318]",
    chip: "bg-[#FDECEA] text-[#8A1C13]",
  },
  medium: {
    label: "Medium risk",
    mark: "bg-[#F9E5BC] border-[#A15C07]",
    bar: "bg-[#A15C07]",
    edge: "border-l-[#A15C07]",
    chip: "bg-[#FCF1DC] text-[#7A4505]",
  },
  low: {
    label: "Low risk",
    mark: "bg-[#D5E6F7] border-[#1D5FA3]",
    bar: "bg-[#1D5FA3]",
    edge: "border-l-[#1D5FA3]",
    chip: "bg-[#E6F0FA] text-[#164A82]",
  },
};

const STATUS: Record<string, string> = {
  awaiting_approval: "Awaiting human approval",
  approved: "Approved",
  changes_requested: "Changes requested",
  escalated: "Escalated",
};
const STATUS_STYLE: Record<string, string> = {
  awaiting_approval: "bg-[#E4E9EE] text-[#2B3A49]",
  approved: "bg-[#DDF0E5] text-[#17553A]",
  changes_requested: "bg-[#FCF1DC] text-[#7A4505]",
  escalated: "bg-[#FDECEA] text-[#8A1C13]",
};

const SAMPLES = [
  {
    label: "Risky ad",
    title: "Summer launch advert",
    text: "Our serum is clinically proven to transform your skin overnight and cuts waste by 90%. It is dermatologist-tested.",
  },
  {
    label: "Reworded claim",
    title: "Social post",
    text: "Scientifically verified to erase wrinkles in a week.",
  },
  {
    label: "Clean ad",
    title: "Product page",
    text: "Glow serum contains 2% niacinamide and is vegan and cruelty-free.",
  },
];

const CHECKS = [
  "Banned terms and risky wording from your brand rules",
  "Numbers that no approved fact supports",
  "Claims that rely on facts which have expired",
  "Reworded claims the rules cannot match, checked by AI",
];

function sevOf(s: string): Severity {
  return s === "high" || s === "low" ? s : "medium";
}

function buildParts(content: string, findings: Finding[]) {
  const lower = content.toLowerCase();
  const ranges: { start: number; end: number; sev: Severity; idx: number }[] = [];
  findings.forEach((f, idx) => {
    if (!f.quote) return;
    const i = lower.indexOf(f.quote.toLowerCase());
    if (i !== -1) ranges.push({ start: i, end: i + f.quote.length, sev: sevOf(f.severity), idx });
  });
  ranges.sort((a, b) => a.start - b.start);
  const parts: Part[] = [];
  const located = new Set<number>();
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue;
    if (r.start > pos) parts.push({ text: content.slice(pos, r.start) });
    parts.push({ text: content.slice(r.start, r.end), sev: r.sev, idx: r.idx });
    located.add(r.idx);
    pos = r.end;
  }
  if (pos < content.length) parts.push({ text: content.slice(pos) });
  return { parts, located };
}

export default function Home() {
  const [role, setRole] = useState("creator");
  const [title, setTitle] = useState(SAMPLES[0].title);
  const [content, setContent] = useState(SAMPLES[0].text);
  const [review, setReview] = useState<Review | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stale, setStale] = useState(false);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  async function runReview() {
    if (!content.trim()) {
      setError("Paste some content first.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, actor: role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review failed");
      setReview(data);
      setComment("");
      setStale(false);
      setEditing(false);
      setActive(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    }
    setLoading(false);
  }

  async function decide(decision: string) {
    if (!review) return;
    setError("");
    const res = await fetch("/api/review/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: review.id, decision, comment, actor: "reviewer" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not save decision");
      return;
    }
    setReview({ ...review, status: data.status });
    setNotice("Decision saved: " + (STATUS[data.status] ?? data.status));
  }

  function selectFinding(i: number) {
    setActive(i);
    const el = document.getElementById("finding-" + i);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function applyFix(f: Finding) {
    const i = content.toLowerCase().indexOf(f.quote.toLowerCase());
    if (i === -1) return;
    setContent(content.slice(0, i) + f.suggested_fix + content.slice(i + f.quote.length));
    setEditing(true);
    setStale(true);
    setNotice("Fix applied to the text. Run the review again to check it.");
  }

  function startEdit() {
    setEditing(true);
    setStale(true);
  }

  function loadSample(s: (typeof SAMPLES)[number]) {
    setTitle(s.title);
    setContent(s.text);
    setReview(null);
    setEditing(false);
    setStale(false);
    setActive(null);
    setError("");
    setNotice("");
  }

  const findings = review ? review.findings ?? [] : [];
  const showProof = review !== null && !editing;
  const built = review ? buildParts(review.content, findings) : { parts: [], located: new Set<number>() };
  const decided = review ? review.status !== "awaiting_approval" : false;
  const count = (s: Severity) => findings.filter((f) => sevOf(f.severity) === s).length;
  const aiCount = findings.filter((f) => f.origin === "ai").length;
  const ruleCount = findings.length - aiCount;
  const verdict =
    findings.length === 0
      ? "No issues found"
      : findings.length + (findings.length === 1 ? " issue" : " issues") + " to resolve before publishing";

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#D5DBE2] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-baseline gap-3">
            <span className="font-doc text-2xl font-semibold tracking-tight">BrandGuard</span>
            <span className="hidden text-sm text-[#566372] sm:inline">
              Brand governance for AI-era content
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/history" className="font-medium underline-offset-4 hover:underline">
              Review history
            </a>
            <div
              role="group"
              aria-label="Role"
              className="flex rounded-md border border-[#D5DBE2] bg-[#EEF1F4] p-0.5"
            >
              {["creator", "reviewer"].map((r) => (
                <button
                  key={r}
                  aria-pressed={role === r}
                  onClick={() => setRole(r)}
                  className={
                    "rounded px-3 py-1 text-sm font-medium transition-colors " +
                    (role === r ? "bg-[#1B3A57] text-white" : "text-[#2B3A49] hover:bg-white")
                  }
                >
                  {r === "creator" ? "Creator" : "Reviewer"}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-6">
          <h1 className="font-doc text-3xl font-semibold tracking-tight md:text-4xl">
            Review content before it goes live
          </h1>
          <p className="mt-1 text-[#566372]">Automation detects. Evidence explains. Humans decide.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section aria-label="Content" className="self-start rounded-lg border border-[#D5DBE2] bg-white">
            <div className="border-b border-[#D5DBE2] px-5 py-3">
              <label htmlFor="title" className="sr-only">
                Title
              </label>
              <input
                id="title"
                className="font-doc w-full rounded border border-transparent px-1 py-0.5 text-xl font-semibold hover:border-[#D5DBE2]"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-[#566372]">Try a sample:</span>
                {SAMPLES.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => loadSample(s)}
                    className="rounded-full border border-[#D5DBE2] px-3 py-0.5 hover:bg-[#EEF1F4]"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {showProof ? (
              <div className="font-doc whitespace-pre-wrap px-5 py-5 text-xl leading-9">
                {built.parts.map((p, k) =>
                  p.sev ? (
                    <mark
                      key={k}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectFinding(p.idx as number)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") selectFinding(p.idx as number);
                      }}
                      className={
                        "cursor-pointer rounded-sm border-b-2 px-0.5 text-[#172230] " +
                        SEV[p.sev].mark +
                        (active === p.idx ? " ring-2 ring-[#172230]" : "")
                      }
                    >
                      {p.text}
                      <sup className="ml-0.5 font-sans text-xs font-semibold">
                        {(p.idx as number) + 1}
                      </sup>
                    </mark>
                  ) : (
                    <span key={k}>{p.text}</span>
                  )
                )}
              </div>
            ) : (
              <>
                <label htmlFor="content" className="sr-only">
                  Content to review
                </label>
                <textarea
                  id="content"
                  className="font-doc block h-56 w-full resize-y px-5 py-4 text-xl leading-9 outline-none"
                  value={content}
                  placeholder="Paste your marketing text here"
                  onChange={(e) => {
                    setContent(e.target.value);
                    if (review) setStale(true);
                  }}
                />
              </>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-[#D5DBE2] px-5 py-3">
              <button
                onClick={runReview}
                disabled={loading}
                className="rounded-md bg-[#1B3A57] px-4 py-2 text-sm font-semibold text-white hover:bg-[#142C43] disabled:opacity-60"
              >
                {loading ? "Checking against brand rules..." : review ? "Run review again" : "Run review"}
              </button>
              {showProof && (
                <button
                  onClick={startEdit}
                  className="rounded-md border border-[#D5DBE2] px-3 py-2 text-sm font-medium hover:bg-[#EEF1F4]"
                >
                  Edit text
                </button>
              )}
              <span className="ml-auto text-xs text-[#566372]">{content.length} characters</span>
            </div>
            {showProof && (
              <p className="border-t border-[#D5DBE2] px-5 py-2 text-xs text-[#566372]">
                Numbered highlights match the findings on the right. Select either to see the other.
              </p>
            )}
          </section>

          <section aria-label="Findings" className="min-w-0">
            <div aria-live="polite">
              {error && (
                <p className="mb-3 rounded-md border border-[#F1B5AE] bg-[#FDECEA] p-3 text-sm text-[#8A1C13]">
                  {error}
                </p>
              )}
              {notice && (
                <p className="mb-3 rounded-md border border-[#B5DBC4] bg-[#DDF0E5] p-3 text-sm text-[#17553A]">
                  {notice}
                </p>
              )}
            </div>

            {!review && (
              <div className="rounded-lg border border-[#D5DBE2] bg-white p-5">
                <h2 className="font-doc text-2xl font-semibold">What gets checked</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {CHECKS.map((c) => (
                    <li key={c} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1B3A57]" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-[#566372]">
                  Every finding names its evidence. A reviewer makes the final call.
                </p>
              </div>
            )}

            {review && (
              <div className="space-y-4">
                <div className="rounded-lg border border-[#D5DBE2] bg-white p-4">
                  <h2 className="font-doc text-2xl font-semibold">{verdict}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {(["high", "medium", "low"] as Severity[]).map((s) => (
                      <span key={s} className={"rounded px-2 py-0.5 font-medium " + SEV[s].chip}>
                        {count(s)} {s}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-[#566372]">
                    {ruleCount} found by rules, {aiCount} found by AI.
                  </p>
                </div>

                {findings.length === 0 && (
                  <p className="rounded-md border border-[#B5DBC4] bg-[#DDF0E5] p-3 text-sm text-[#17553A]">
                    Nothing in this text conflicts with your brand rules. A reviewer can still approve or
                    reject it below.
                  </p>
                )}

                {findings.map((f, i) => {
                  const sv = sevOf(f.severity);
                  const s = SEV[sv];
                  const conf = Math.max(0, Math.min(100, Math.round((f.confidence ?? 0.5) * 100)));
                  return (
                    <article
                      key={i}
                      id={"finding-" + i}
                      onClick={() => setActive(i)}
                      className={
                        "rounded-md border border-[#D5DBE2] border-l-4 bg-white p-4 " +
                        s.edge +
                        (active === i ? " ring-2 ring-[#172230]" : "")
                      }
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white " +
                            s.bar
                          }
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold">{f.issue}</h3>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={"rounded px-2 py-0.5 font-medium " + s.chip}>{s.label}</span>
                              <span className="rounded border border-[#D5DBE2] px-2 py-0.5 text-[#2B3A49]">
                                {f.origin === "ai" ? "Found by AI" : "Found by rules"}
                              </span>
                            </div>
                          </div>
                          <p className="font-doc mt-2 text-lg">&ldquo;{f.quote}&rdquo;</p>
                          {!built.located.has(i) && (
                            <p className="text-xs text-[#566372]">Not matched word for word in the text.</p>
                          )}
                          <p className="mt-1 text-sm">{f.reason}</p>
                          <p className="mt-2 text-sm text-[#566372]">
                            <span className="font-medium text-[#172230]">Evidence:</span> {f.source}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-[#566372]">
                            <span>Confidence {conf}%</span>
                            <div className="h-1.5 w-24 rounded bg-[#E4E9EE]">
                              <div className={"h-1.5 rounded " + s.bar} style={{ width: conf + "%" }} />
                            </div>
                          </div>
                          <div className="mt-3 rounded bg-[#EEF1F4] p-3 text-sm">
                            <p className="font-medium">Suggested fix</p>
                            <p className="mt-0.5">{f.suggested_fix}</p>
                            {f.issue === "Banned term" && !decided && (
                              <button
                                onClick={() => applyFix(f)}
                                className="mt-2 rounded border border-[#1B3A57] bg-white px-3 py-1 text-sm font-medium text-[#1B3A57] hover:bg-[#E4E9EE]"
                              >
                                Apply fix
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}

                <div className="rounded-lg border border-[#D5DBE2] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-doc text-xl font-semibold">Reviewer decision</h2>
                    <span
                      className={
                        "rounded px-2 py-0.5 text-xs font-medium " +
                        (STATUS_STYLE[review.status] ?? "bg-[#E4E9EE] text-[#2B3A49]")
                      }
                    >
                      {STATUS[review.status] ?? review.status}
                    </span>
                  </div>

                  {stale && !decided && (
                    <p className="mt-3 rounded-md border border-[#EBCB8A] bg-[#FCF1DC] p-3 text-sm text-[#7A4505]">
                      The text changed after this review. Run the review again before deciding.
                    </p>
                  )}

                  {role === "creator" && !decided && !stale && (
                    <p className="mt-3 text-sm text-[#566372]">
                      Switch to Reviewer to approve, request changes or escalate.
                    </p>
                  )}

                  {role === "reviewer" && !decided && !stale && (
                    <div className="mt-3">
                      <label htmlFor="comment" className="text-sm font-medium">
                        Comment
                      </label>
                      <input
                        id="comment"
                        className="mt-1 w-full rounded-md border border-[#D5DBE2] p-2 text-sm"
                        placeholder="Required to request changes or escalate"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => decide("approved")}
                          className="rounded-md bg-[#1F6B45] px-4 py-2 text-sm font-semibold text-white hover:bg-[#185637]"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => decide("changes_requested")}
                          className="rounded-md border border-[#1B3A57] px-4 py-2 text-sm font-semibold text-[#1B3A57] hover:bg-[#EEF1F4]"
                        >
                          Request changes
                        </button>
                        <button
                          onClick={() => decide("escalated")}
                          className="rounded-md border border-[#D5DBE2] px-4 py-2 text-sm font-semibold hover:bg-[#EEF1F4]"
                        >
                          Escalate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
