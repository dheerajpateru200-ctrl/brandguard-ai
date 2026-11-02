
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AuditLog = {
  id: number;
  review_id: string | null;
  action: string;
  actor: string;
  comment: string | null;
  created_at: string;
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const session = localStorage.getItem("bg_session");

      if (!session) {
        throw new Error("Please log in again.");
      }

      let parsed: Record<string, unknown>;

      try {
        parsed = JSON.parse(session);
      } catch {
        localStorage.removeItem("bg_session");
        throw new Error("Your session is invalid. Please log in again.");
      }

      // Support the session formats used across the application.
      const token =
        parsed.token ||
        parsed.access_token ||
        parsed.accessToken;

      if (typeof token !== "string" || !token.trim()) {
        throw new Error("Session token not found. Please log in again.");
      }

      const response = await fetch("/api/admin/audit", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (response.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
      }

      if (response.status === 403) {
        throw new Error("Admin access required to view audit logs.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Unable to load audit logs.");
      }

      setLogs(Array.isArray(result.logs) ? result.logs : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((log) => {
    const matchesFilter =
      filter === "all" ||
      log.action.toLowerCase().includes(filter);

    const searchableText = [
      log.action,
      log.actor,
      log.comment || "",
      log.review_id || "",
    ]
      .join(" ")
      .toLowerCase();

    return (
      matchesFilter &&
      searchableText.includes(search.trim().toLowerCase())
    );
  });

  const formatDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const governanceCount = logs.filter((log) =>
    /banned|fact|user|reviewer_request/i.test(log.action)
  ).length;

  const reviewDecisionCount = logs.filter((log) =>
    /approved|changes_requested|escalated/i.test(log.action)
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="mb-3 inline-block text-sm text-blue-400 hover:text-blue-300"
            >
              ← Back to Admin Console
            </Link>

            <h1 className="text-3xl font-bold">Audit Log</h1>

            <p className="mt-2 text-sm text-slate-400">
              Track governance changes and review decisions.
            </p>
          </div>

          <button
            onClick={loadLogs}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total records loaded</p>
            <p className="mt-2 text-3xl font-bold">{logs.length}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Governance changes</p>
            <p className="mt-2 text-3xl font-bold">{governanceCount}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Review decisions</p>
            <p className="mt-2 text-3xl font-bold">
              {reviewDecisionCount}
            </p>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, action, comment or review ID..."
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm"
          >
            <option value="all">All actions</option>
            <option value="banned">Banned terms</option>
            <option value="fact">Approved facts</option>
            <option value="user">User management</option>
            <option value="reviewer_request">Reviewer requests</option>
            <option value="approved">Approved reviews</option>
            <option value="changes_requested">Changes requested</option>
            <option value="escalated">Escalated reviews</option>
          </select>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-800 bg-red-950 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading audit history...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
            <p className="font-semibold">No audit records found</p>
            <p className="mt-2 text-sm text-slate-400">
              Try changing your search or filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Actor</th>
                  <th className="px-5 py-4">Comment</th>
                  <th className="px-5 py-4">Review ID</th>
                  <th className="px-5 py-4">Date and time</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/50">
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-blue-950 px-2 py-1 text-xs font-medium text-blue-300">
                        {log.action.replaceAll("_", " ")}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-200">
                      {log.actor}
                    </td>

                    <td className="max-w-xs whitespace-normal px-5 py-4 text-slate-400">
                      {log.comment || "—"}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500">
                      {log.review_id || "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-slate-400">
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-500">
          Showing up to 200 latest records. Audit entries are read-only here.
        </p>
      </div>
    </main>
  );
}
