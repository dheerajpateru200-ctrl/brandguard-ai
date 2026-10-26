"use client";
import { useState } from "react";

type Severity = "high" | "medium" | "low";
type Finding = {
  quote: string;
  issue: string;
  reason: string;
  source: string;
  severity: Severity;
  confidence: number;
  suggested_fix: string;
  origin: string;
};
type Review = { id: string; title: string; content: string; status: string; findings: Finding[] };
type Part = { text: string; sev?: Severity };

const MARK: Record<Severity, string> = {
  high: "bg-red-200 text-red-900",
  medium: "bg-amber-200 text-amber-900",
  low: "bg-sky-200 text-sky-900",
};
const CARD: Record<Severity, string> = {
  high: "border-red-300 bg-red-50",
  medium: "border-amber-300 bg-amber-50",
  low: "border-sky-300 bg-sky-50",
};
const STATUS: Record<string, string> = {
  awaiting_approval: "Awaiting human approval",
  approved: "Approved",
  changes_requested: "Changes requested",
  escalated: "Escalated",
};

function buildParts(content: string, findings: Finding[]): Part[] {
  const lower = content.toLowerCase();
  const ranges: { start: number; end: number; sev: Severity }[] = [];
  for (const f of findings) {
    if (!f.quote) continue;
    const i = lower.indexOf(f.quote.toLowerCase());
    if (i !== -1) ranges.push({ start: i, end: i + f.quote.length, sev: f.severity });
  }
  ranges.sort((a, b) => a.start - b.start);
  const parts: Part[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue;
    if (r.start > pos) parts.push({ text: content.slice(pos, r.start) });
    parts.push({ text: content.slice(r.start, r.end), sev: r.sev });
    pos = r.end;
  }
  if (pos < content.length) parts.push({ text: content.slice(pos) });
  return parts;
}

export default function Home() {
  const [role, setRole] = useState("creator");
  const [title, setTitle] = useState("Summer launch advert");
  const [content, setContent] = useState(
    "Our serum is clinically proven to transform your skin overnight and cuts waste by 90%. It is dermatologist-tested."
  );
  const [review, setReview] = useState<Review | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runReview() {
    setLoading(true);
    setError("");
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
  }

  const parts = review ? buildParts(review.content, review.findings) : [];
  const decided = review ? review.status !== "awaiting_approval" : false;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold">BrandGuard AI</h1>
        <label className="text-sm">
          Role:{" "}
          <select
            className="rounded border p-1"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="creator">Creator</option>
            <option value="reviewer">Reviewer</option>
          </select>
        </label>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Submit content</h2>
          <input
            className="mb-2 w-full rounded border p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
          <textarea
            className="h-40 w-full rounded border p-2"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your content here"
          />
          <button
            className="mt-2 rounded bg-black px-4 py-2 text-white"
            onClick={runReview}
            disabled={loading}
          >
            {loading ? "Reviewing..." : "Run review"}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {review && (
            <div className="mt-6">
              <h2 className="mb-2 font-semibold">Highlighted content</h2>
              <p className="rounded bg-gray-100 p-3 leading-8">
                {parts.map((p, i) =>
                  p.sev ? (
                    <mark key={i} className={"rounded px-1 " + MARK[p.sev]}>
                      {p.text}
                    </mark>
                  ) : (
                    <span key={i}>{p.text}</span>
                  )
                )}
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-semibold">
            Findings {review ? "(" + review.findings.length + ")" : ""}
          </h2>
          {!review && (
            <p className="text-sm text-gray-500">
              Run a review to see findings, evidence and suggested fixes.
            </p>
          )}
          {review && review.findings.length === 0 && (
            <p className="text-sm text-green-700">No issues found.</p>
          )}
          <div className="space-y-3">
            {review?.findings.map((f, i) => (
              <div key={i} className={"rounded border p-3 " + CARD[f.severity]}>
                <div className="flex justify-between text-sm font-semibold">
                  <span>{f.issue}</span>
                  <span>
                    {f.severity} - {Math.round(f.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  Text: <b>{f.quote}</b>
                </p>
                <p className="mt-1 text-sm">{f.reason}</p>
                <p className="mt-1 text-xs text-gray-600">Source: {f.source}</p>
                <p className="mt-2 rounded bg-white p-2 text-sm">
                  Suggested fix: {f.suggested_fix}
                </p>
              </div>
            ))}
          </div>

          {review && (
            <div className="mt-6 rounded border p-3">
              <p className="mb-2 text-sm">
                Status: <b>{STATUS[review.status] ?? review.status}</b>
              </p>
              {role === "reviewer" && !decided && (
                <>
                  <input
                    className="mb-2 w-full rounded border p-2 text-sm"
                    placeholder="Add a comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="rounded bg-green-700 px-3 py-1 text-white"
                      onClick={() => decide("approved")}
                    >
                      Approve
                    </button>
                    <button
                      className="rounded bg-amber-600 px-3 py-1 text-white"
                      onClick={() => decide("changes_requested")}
                    >
                      Request changes
                    </button>
                    <button
                      className="rounded bg-gray-700 px-3 py-1 text-white"
                      onClick={() => decide("escalated")}
                    >
                      Escalate
                    </button>
                  </div>
                </>
              )}
              {role === "creator" && !decided && (
                <p className="text-sm text-gray-500">
                  Switch the role to Reviewer to approve or request changes.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
