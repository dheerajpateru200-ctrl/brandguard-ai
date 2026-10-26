"use client";
import { useEffect, useState } from "react";

type Review = {
  id: string;
  title: string;
  status: string;
  findings: unknown[];
  decision_comment: string | null;
  decided_by: string | null;
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
  awaiting_approval: "bg-gray-200 text-gray-800",
  approved: "bg-green-200 text-green-900",
  changes_requested: "bg-amber-200 text-amber-900",
  escalated: "bg-red-200 text-red-900",
};

export default function History() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reviews")
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
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold">Review history</h1>
        <a href="/" className="text-sm underline">
          Back to review
        </a>
      </header>
      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && reviews.length === 0 && (
        <p className="text-sm text-gray-500">No reviews yet. Run a review first.</p>
      )}
      <div className="space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="rounded border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{r.title}</h2>
              <span className={"rounded px-2 py-1 text-xs " + (BADGE[r.status] ?? "bg-gray-200")}>
                {STATUS[r.status] ?? r.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {new Date(r.created_at).toLocaleString()} - {r.findings.length} findings
            </p>
            {r.decision_comment && (
              <p className="mt-2 text-sm">
                Reviewer comment: <i>{r.decision_comment}</i>
              </p>
            )}
            <ul className="mt-3 border-t pt-2 text-xs text-gray-700">
              {audit
                .filter((a) => a.review_id === r.id)
                .map((a) => (
                  <li key={a.id}>
                    {new Date(a.created_at).toLocaleTimeString()} - {a.actor}: {a.action}
                    {a.comment ? " (" + a.comment + ")" : ""}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
