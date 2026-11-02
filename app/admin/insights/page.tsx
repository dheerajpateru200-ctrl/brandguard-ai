
"use client";

import { useCallback, useEffect, useState } from "react";

type Insights = {
  summary: {
    totalSubmissions: number;
    pending: number;
    approved: number;
    changesRequested: number;
    escalated: number;
    decided: number;
    approvalRate: number;
  };
  dailyActivity: {
    date: string;
    submissions: number;
    decisions: number;
  }[];
  topFindings: { name: string; count: number }[];
  reviewerActivity: { reviewer: string; decisions: number }[];
};

function getToken() {
  try {
    const raw = localStorage.getItem("bg_session");
    if (!raw) return "";
    const session = JSON.parse(raw);
    return session.token || session.access_token || session.accessToken || "";
  } catch {
    return "";
  }
}

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        setError("Please log in as an administrator.");
        setData(null);
        return;
      }

      const params = new URLSearchParams();
      if (from) params.set("from", new Date(from).toISOString());
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }

      const response = await fetch(
        `/api/admin/insights?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load insights.");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load insights."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const summary = data?.summary;

  const metrics = [
    { label: "Total submissions", value: summary?.totalSubmissions ?? 0 },
    { label: "Pending reviews", value: summary?.pending ?? 0 },
    { label: "Approved", value: summary?.approved ?? 0 },
    { label: "Changes requested", value: summary?.changesRequested ?? 0 },
    { label: "Escalated", value: summary?.escalated ?? 0 },
    { label: "Approval rate", value: `${summary?.approvalRate ?? 0}%` },
  ];

  const maxActivity = Math.max(
    1,
    ...(data?.dailyActivity || []).flatMap((item) => [
      item.submissions,
      item.decisions,
    ])
  );

  const maxFinding = Math.max(
    1,
    ...(data?.topFindings || []).map((item) => item.count)
  );

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-400">
              BRANDGUARD AI / ADMIN
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Insights Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Real-time review and governance analytics.
            </p>
          </div>

          <a
            href="/admin"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Back to Admin
          </a>
        </header>

        <section className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <label className="text-sm text-slate-400">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>

          <label className="text-sm text-slate-400">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>

          <button
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Clear filters
          </button>

          <button
            onClick={loadInsights}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </section>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && !data && (
          <p className="text-sm text-slate-400">Loading analytics...</p>
        )}

        {data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <p className="text-sm text-slate-400">{metric.label}</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight">
                    {metric.value}
                  </p>
                </div>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-lg font-semibold">Review activity</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Submissions and decisions by day
                </p>

                {data.dailyActivity.length === 0 ? (
                  <p className="mt-6 text-sm text-slate-500">
                    No activity for this period.
                  </p>
                ) : (
                  <div className="mt-6 space-y-4">
                    {data.dailyActivity.slice(-14).map((item) => (
                      <div key={item.date}>
                        <div className="mb-2 flex justify-between text-xs text-slate-400">
                          <span>{item.date}</span>
                          <span>
                            {item.submissions} submissions · {item.decisions} decisions
                          </span>
                        </div>
                        <div className="flex h-3 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="bg-indigo-500"
                            style={{
                              width: `${(item.submissions / maxActivity) * 100}%`,
                            }}
                          />
                          <div
                            className="bg-emerald-500"
                            style={{
                              width: `${(item.decisions / maxActivity) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex gap-5 text-xs text-slate-400">
                  <span>■ Submissions</span>
                  <span>■ Decisions</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-lg font-semibold">Top AI findings</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Most frequently detected finding labels
                </p>

                {data.topFindings.length === 0 ? (
                  <p className="mt-6 text-sm text-slate-500">
                    No findings available.
                  </p>
                ) : (
                  <div className="mt-6 space-y-5">
                    {data.topFindings.map((item) => (
                      <div key={item.name}>
                        <div className="mb-2 flex justify-between gap-3 text-sm">
                          <span className="truncate text-slate-300">
                            {item.name}
                          </span>
                          <span className="font-semibold">{item.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{
                              width: `${(item.count / maxFinding) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-lg font-semibold">Reviewer activity</h2>
              <p className="mt-1 text-sm text-slate-400">
                Decisions recorded in the audit log
              </p>

              {data.reviewerActivity.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  No reviewer decisions recorded.
                </p>
              ) : (
                <div className="mt-5 divide-y divide-slate-800">
                  {data.reviewerActivity.map((item) => (
                    <div
                      key={item.reviewer}
                      className="flex justify-between gap-4 py-3 text-sm"
                    >
                      <span className="break-all text-slate-300">
                        {item.reviewer}
                      </span>
                      <span className="font-semibold">
                        {item.decisions} decisions
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
