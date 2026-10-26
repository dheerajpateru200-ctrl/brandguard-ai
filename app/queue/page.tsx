"use client";
import { useCallback, useEffect, useState } from "react";

type Finding = {
  quote: string;
  issue: string;
  reason: string;
  source: string;
  severity: string;
  suggested_fix: string;
  origin: string;
};
type Item = {
  id: string;
  title: string;
  content: string;
  findings: Finding[];
  created_by: string | null;
  created_at: string;
};

const CHIP: Record<string, string> = {
  high: "bg-[#FDECEA] text-[#8A1C13]",
  medium: "bg-[#FCF1DC] text-[#7A4505]",
  low: "bg-[#E6F0FA] text-[#164A82]",
};

function getToken() {
  try {
    return JSON.parse(localStorage.getItem("bg_session") || "{}").token || "";
  } catch {
    return "";
  }
}

function waited(iso: string, now: number) {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Just arrived";
  if (mins < 60) return "Waiting " + mins + " min";
  return "Waiting " + Math.floor(mins / 60) + " h " + (mins % 60) + " min";
}

export default function Queue() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setError("Log in as a reviewer first.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/queue", { headers: { Authorization: "Bearer " + t } });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Could not load the queue.");
        setItems([]);
      } else {
        setError("");
        setItems(d.reviews);
      }
    } catch {
      setError("Could not load the queue.");
    }
    setNow(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  async function decide(item: Item, decision: string) {
    setError("");
    setNotice("");
    const res = await fetch("/api/review/decide", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify({ id: item.id, decision, comment }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Could not save the decision.");
      if (res.status === 409) load();
      return;
    }
    setNotice("Decision saved for " + item.title + ".");
    setOpen(null);
    setComment("");
    load();
  }

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
        <h1 className="font-doc text-3xl font-semibold tracking-tight">Review queue</h1>
        <p className="mt-1 text-[#566372]">
          Waiting for a decision, oldest first. The list refreshes every 15 seconds.
        </p>

        <div aria-live="polite" className="mt-4">
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

        {loading && <p className="text-sm text-[#566372]">Loading...</p>}
        {!loading && !error && items.length === 0 && (
          <div className="rounded-lg border border-[#D5DBE2] bg-white p-5">
            <h2 className="font-doc text-xl font-semibold">The queue is empty</h2>
            <p className="mt-1 text-sm text-[#566372]">
              New submissions appear here as soon as a creator runs a review.
            </p>
          </div>
        )}

        <ol className="space-y-3">
          {items.map((it, n) => {
            const isOpen = open === it.id;
            return (
              <li key={it.id} className="rounded-lg border border-[#D5DBE2] bg-white">
                <button
                  className="flex w-full items-center gap-3 p-4 text-left"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpen(isOpen ? null : it.id);
                    setComment("");
                  }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B3A57] text-sm font-semibold text-white">
                    {n + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{it.title}</span>
                    <span className="block text-sm text-[#566372]">
                      From {it.created_by || "unknown"}, {waited(it.created_at, now)},{" "}
                      {it.findings.length} {it.findings.length === 1 ? "finding" : "findings"}
                    </span>
                  </span>
                  <span className="text-sm font-medium">{isOpen ? "Close" : "Open"}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-[#D5DBE2] p-4">
                    <p className="font-doc whitespace-pre-wrap text-lg leading-8">{it.content}</p>

                    <div className="mt-4 space-y-2">
                      {it.findings.map((f, i) => (
                        <div key={i} className="rounded-md bg-[#EEF1F4] p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{f.issue}</span>
                            <span
                              className={
                                "rounded px-2 py-0.5 text-xs font-medium " +
                                (CHIP[f.severity] ?? CHIP.medium)
                              }
                            >
                              {f.severity}
                            </span>
                            <span className="text-xs text-[#566372]">
                              {f.origin === "ai" ? "Found by AI" : "Found by rules"}
                            </span>
                          </div>
                          <p className="font-doc mt-1 text-base">&ldquo;{f.quote}&rdquo;</p>
                          <p className="mt-1">{f.reason}</p>
                          <p className="mt-1 text-[#566372]">Evidence: {f.source}</p>
                          <p className="mt-1">Suggested fix: {f.suggested_fix}</p>
                        </div>
                      ))}
                    </div>

                    <label htmlFor={"c-" + it.id} className="mt-4 block text-sm font-medium">
                      Comment
                    </label>
                    <input
                      id={"c-" + it.id}
                      className="mt-1 w-full rounded-md border border-[#D5DBE2] p-2 text-sm"
                      placeholder="Required to request changes or escalate"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => decide(it, "approved")}
                        className="rounded-md bg-[#1F6B45] px-4 py-2 text-sm font-semibold text-white hover:bg-[#185637]"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decide(it, "changes_requested")}
                        className="rounded-md border border-[#1B3A57] px-4 py-2 text-sm font-semibold text-[#1B3A57] hover:bg-[#EEF1F4]"
                      >
                        Request changes
                      </button>
                      <button
                        onClick={() => decide(it, "escalated")}
                        className="rounded-md border border-[#D5DBE2] px-4 py-2 text-sm font-semibold hover:bg-[#EEF1F4]"
                      >
                        Escalate
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}