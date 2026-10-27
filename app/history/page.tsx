"use client";
import { useEffect, useState } from "react";

type Review = {
  id: string;
  title: string;
  status: string;
  findings: unknown[];
  decision_comment: string | null;
  decided_by: string | null;
  created_by: string | null;
  created_at: string;
};
type Audit = {
  id: number;
  review_id: string;
  action: string;
  actor: string;
  comment: string | null;
  created_at: string;
};

const STATUS: Record<string, string> = {
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  changes_requested: "Changes requested",
  escalated: "Escalated",
};
const BADGE: Record<string, string> = {
  awaiting_approval: "bg-[#E4E9EE] text-[#2B3A49]",
  approved: "bg-[#DDF0E5] text-[#17553A]",
  changes_requested: "bg-[#FCF1DC] text-[#7A4505]",
  escalated: "bg-[#FDECEA] text-[#8A1C13]",
};

export default function History() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let token = "";
    try {
      token = JSON.parse(localStorage.getItem("bg_session") || "{}").token || "";
    } catch {
      token = "";
    }
    if (!token) {
      setError("Log in first to see the review history.");
      setLoading(false);
      return;
    }
    fetch("/api/reviews", { headers: { Authorization: "Bearer " + token } })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setReviews(d.reviews);
          setAudit(d.audit);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load history.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#D5DBE2] bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 md:px-6">
          <span className="font-doc text-2xl font-semibold tracking-tight">BrandGuard</span>
          <a href="/" className="text-sm font-medium underline-offset-4 hover:underline">
            Back to review
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        <h1 className="font-doc text-3xl font-semibold tracking-tight">Review history</h1>
        <p className="mt-1 text-[#566372]">
          Every submission and decision, with who did what and when.
        </p>

        <div className="mt-4" aria-live="polite">
          {loading && <p className="text-sm text-[#566372]">Loading...</p>}
          {error && (
            <p className="rounded-md border border-[#F1B5AE] bg-[#FDECEA] p-3 text-sm text-[#8A1C13]">
              {error}
            </p>
          )}
          {!loading && !error && reviews.length === 0 && (
            <div className="rounded-lg border border-[#D5DBE2] bg-white p-5">
              <h2 className="font-doc text-xl font-semibold">No reviews yet</h2>
              <p className="mt-1 text-sm text-[#566372]">Run a review and it will appear here.</p>
            </div>
          )}
        </div>

        <div className="mt-2 space-y-4">
          {reviews.map((r) => (
            <article key={r.id} className="rounded-lg border border-[#D5DBE2] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-doc text-xl font-semibold">{r.title}</h2>
                <span
                  className={
                    "rounded px-2 py-0.5 text-xs font-medium " + (BADGE[r.status] ?? "bg-[#E4E9EE]")
                  }
                >
                  {STATUS[r.status] ?? r.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#566372]">
                Submitted by {r.created_by || "unknown"} on {new Date(r.created_at).toLocaleString()},{" "}
                {r.findings.length} {r.findings.length === 1 ? "finding" : "findings"}
              </p>
              {r.decision_comment && (
                <p className="mt-2 text-sm">
                  <span className="font-medium">
                    Reviewer comment{r.decided_by ? " (" + r.decided_by + ")" : ""}:
                  </span>{" "}
                  {r.decision_comment}
                </p>
              )}
              <ul className="mt-3 space-y-1 border-t border-[#D5DBE2] pt-3 text-sm text-[#2B3A49]">
                {audit
                  .filter((a) => a.review_id === r.id)
                  .map((a) => (
                    <li key={a.id}>
                      <span className="text-[#566372]">{new Date(a.created_at).toLocaleTimeString()}</span>{" "}
                      {a.actor}: {a.action.replace(/_/g, " ")}
                      {a.comment ? " (" + a.comment + ")" : ""}
                    </li>
                  ))}
              </ul>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
