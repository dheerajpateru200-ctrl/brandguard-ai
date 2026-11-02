
"use client";

import { useCallback, useEffect, useState } from "react";

type ReviewerRequest = {
  id: number;
  user_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  created_at: string;
  requester: {
    id: string;
    email: string;
    role: string;
  } | null;
};

function getToken() {
  try {
    return JSON.parse(localStorage.getItem("bg_session") || "{}").token || "";
  } catch {
    return "";
  }
}

const cardClass =
  "rounded-2xl border border-white/80 bg-white/80 shadow-[0_8px_30px_rgba(59,80,160,0.07)] backdrop-blur-xl";

export default function AdminReviewerRequestsPage() {
  const [requests, setRequests] = useState<ReviewerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [processing, setProcessing] = useState<number | null>(null);
  const [filter, setFilter] = useState("pending");

  const loadRequests = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("Please log in as an administrator.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/reviewer-requests", {
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not load reviewer requests.");
        setRequests([]);
        return;
      }

      setError("");
      setRequests(data.requests || []);
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function decideRequest(
    requestId: number,
    decision: "approved" | "rejected"
  ) {
    const action = decision === "approved" ? "approve" : "reject";

    if (!window.confirm(`Are you sure you want to ${action} this request?`)) {
      return;
    }

    setError("");
    setNotice("");
    setProcessing(requestId);

    try {
      const res = await fetch("/api/admin/reviewer-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + getToken(),
        },
        body: JSON.stringify({
          id: requestId,
          decision,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not update the request.");
        return;
      }

      setNotice(data.message || "Request updated successfully.");
      await loadRequests();
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setProcessing(null);
    }
  }

  const pendingCount = requests.filter(
    (request) => request.status === "pending"
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status === "approved"
  ).length;

  const rejectedCount = requests.filter(
    (request) => request.status === "rejected"
  ).length;

  const filteredRequests =
    filter === "all"
      ? requests
      : requests.filter((request) => request.status === filter);

  const filters = [
    { value: "pending", label: "Pending", count: pendingCount },
    { value: "approved", label: "Approved", count: approvedCount },
    { value: "rejected", label: "Rejected", count: rejectedCount },
    { value: "all", label: "All requests", count: requests.length },
  ];

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#f8faff] to-[#ede9fe] text-[#172554]">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="absolute -right-40 top-40 h-[30rem] w-[30rem] rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-200/30 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div>
            <a
              href="/"
              className="font-doc text-2xl font-semibold tracking-tight text-slate-900"
            >
              BrandGuard
            </a>
            <p className="text-xs text-slate-500">
              Brand governance administration
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <a
              href="/admin"
              className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              ← Admin Dashboard
            </a>

            <a
              href="/"
              className="font-medium text-slate-600 transition hover:text-indigo-700"
            >
              Home
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10 md:px-6">
        {/* Page heading */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-700">
              Administration
            </p>

            <h1 className="mt-2 font-doc text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">
              Reviewer Access Requests
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Review applications and manage who can approve content across
              your BrandGuard workspace.
            </p>
          </div>

          <button
            onClick={loadRequests}
            disabled={loading}
            className="rounded-xl border border-indigo-100 bg-white/90 px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800 shadow-sm"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-800 shadow-sm"
          >
            {notice}
          </div>
        )}

        {/* Statistics */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className={`${cardClass} p-6 transition hover:-translate-y-1`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Pending requests
              </p>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-xl text-amber-700">
                ◷
              </span>
            </div>

            <p className="mt-3 text-4xl font-bold tracking-tight text-amber-600">
              {pendingCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Waiting for administrator review
            </p>
          </div>

          <div className={`${cardClass} p-6 transition hover:-translate-y-1`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Approved requests
              </p>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-700">
                ✓
              </span>
            </div>

            <p className="mt-3 text-4xl font-bold tracking-tight text-emerald-600">
              {approvedCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Reviewer access granted
            </p>
          </div>

          <div className={`${cardClass} p-6 transition hover:-translate-y-1`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Rejected requests
              </p>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-xl text-red-700">
                ×
              </span>
            </div>

            <p className="mt-3 text-4xl font-bold tracking-tight text-red-600">
              {rejectedCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Requests not approved
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="mt-9">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Manage applications
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Filter applications by their current status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  filter === option.value
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : "border border-white/80 bg-white/80 text-slate-600 shadow-sm hover:border-indigo-200 hover:bg-white"
                }`}
              >
                {option.label}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    filter === option.value
                      ? "bg-white/20 text-white"
                      : "bg-indigo-50 text-indigo-700"
                  }`}
                >
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Requests */}
        <section className="mt-5 space-y-4">
          {loading ? (
            <div className={`${cardClass} flex items-center gap-3 p-7 text-sm text-slate-600`}>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              Loading reviewer requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className={`${cardClass} p-10 text-center`}>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-3xl text-indigo-500">
                ◇
              </div>

              <h2 className="font-doc text-xl font-bold text-slate-900">
                No requests found
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                There are no requests in this category.
              </p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <article
                key={request.id}
                className={`${cardClass} p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white md:p-6`}
              >
                {/* Request header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 text-lg font-bold text-indigo-700">
                      {(request.requester?.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div>
                      <h2 className="font-bold text-slate-900">
                        {request.requester?.email || "Unknown requester"}
                      </h2>

                      <p className="mt-1 text-xs text-slate-500">
                        Request ID: {request.id}
                      </p>

                      {request.requester?.role && (
                        <p className="mt-1 text-xs text-slate-500">
                          Current role: {request.requester.role}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      request.status === "pending"
                        ? "border border-amber-200 bg-amber-50 text-amber-700"
                        : request.status === "approved"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {request.status.toUpperCase()}
                  </span>
                </div>

                {/* Request reason */}
                <div className="mt-5 rounded-2xl border border-indigo-100/70 bg-indigo-50/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    Reason for requesting access
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {request.reason}
                  </p>
                </div>

                {/* Dates */}
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                  <span>
                    Submitted: {new Date(request.created_at).toLocaleString()}
                  </span>

                  {request.reviewed_at && (
                    <span>
                      Reviewed:{" "}
                      {new Date(request.reviewed_at).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Actions */}
                {request.status === "pending" && (
                  <div className="mt-5 flex flex-wrap gap-3 border-t border-indigo-100/70 pt-5">
                    <button
                      disabled={processing === request.id}
                      onClick={() =>
                        decideRequest(request.id, "approved")
                      }
                      className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-100 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processing === request.id
                        ? "Processing..."
                        : "✓ Approve Reviewer Access"}
                    </button>

                    <button
                      disabled={processing === request.id}
                      onClick={() =>
                        decideRequest(request.id, "rejected")
                      }
                      className="rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processing === request.id
                        ? "Processing..."
                        : "Reject Request"}
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </section>

        <footer className="mt-8 pb-5 text-center text-xs text-slate-500">
          BrandGuard Governance · Reviewer permissions are managed by
          administrators.
        </footer>
      </main>
    </div>
  );
}
