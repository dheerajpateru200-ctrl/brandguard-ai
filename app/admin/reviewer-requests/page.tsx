
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

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="border-b border-[#D5DBE2] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <span className="font-doc text-2xl font-semibold tracking-tight">
            BrandGuard
          </span>

          <div className="flex items-center gap-4">
            <a
              href="/admin"
              className="text-sm font-medium text-[#1B3A57] hover:underline"
            >
              Admin Dashboard
            </a>

            <a
              href="/"
              className="text-sm font-medium text-[#566372] hover:underline"
            >
              Home
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#64748B]">
              Administration
            </p>
            <h1 className="font-doc mt-1 text-3xl font-semibold tracking-tight text-[#17212B]">
              Reviewer Access Requests
            </h1>
            <p className="mt-2 text-sm text-[#566372]">
              Review applications and manage who can approve content.
            </p>
          </div>

          <button
            onClick={loadRequests}
            className="rounded-lg border border-[#D5DBE2] bg-white px-4 py-2 text-sm font-semibold text-[#1B3A57] hover:bg-[#EEF1F4]"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-[#F1B5AE] bg-[#FDECEA] p-4 text-sm text-[#8A1C13]"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-5 rounded-lg border border-[#B5DBC4] bg-[#DDF0E5] p-4 text-sm text-[#17553A]"
          >
            {notice}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#D5DBE2] bg-white p-5">
            <p className="text-sm text-[#64748B]">Pending</p>
            <p className="mt-2 text-3xl font-semibold text-[#A45B0A]">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-xl border border-[#D5DBE2] bg-white p-5">
            <p className="text-sm text-[#64748B]">Approved</p>
            <p className="mt-2 text-3xl font-semibold text-[#1F6B45]">
              {approvedCount}
            </p>
          </div>

          <div className="rounded-xl border border-[#D5DBE2] bg-white p-5">
            <p className="text-sm text-[#64748B]">Rejected</p>
            <p className="mt-2 text-3xl font-semibold text-[#8A1C13]">
              {rejectedCount}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "all", label: "All requests" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                filter === option.value
                  ? "bg-[#1B3A57] text-white"
                  : "border border-[#D5DBE2] bg-white text-[#566372] hover:bg-[#EEF1F4]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <section className="mt-4 space-y-4">
          {loading ? (
            <p className="rounded-lg border border-[#D5DBE2] bg-white p-5 text-sm text-[#566372]">
              Loading reviewer requests...
            </p>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-xl border border-[#D5DBE2] bg-white p-8 text-center">
              <h2 className="font-doc text-xl font-semibold text-[#17212B]">
                No requests found
              </h2>
              <p className="mt-2 text-sm text-[#64748B]">
                There are no requests in this category.
              </p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <article
                key={request.id}
                className="rounded-xl border border-[#D5DBE2] bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[#17212B]">
                      {request.requester?.email || "Unknown requester"}
                    </h2>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Request ID: {request.id}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      request.status === "pending"
                        ? "bg-[#FCF1DC] text-[#7A4505]"
                        : request.status === "approved"
                          ? "bg-[#DDF0E5] text-[#17553A]"
                          : "bg-[#FDECEA] text-[#8A1C13]"
                    }`}
                  >
                    {request.status.toUpperCase()}
                  </span>
                </div>

                <div className="mt-4 rounded-lg bg-[#F7F8FA] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Reason for requesting access
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#344252]">
                    {request.reason}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#64748B]">
                  <span>
                    Submitted:{" "}
                    {new Date(request.created_at).toLocaleString()}
                  </span>

                  {request.reviewed_at && (
                    <span>
                      Reviewed:{" "}
                      {new Date(request.reviewed_at).toLocaleString()}
                    </span>
                  )}
                </div>

                {request.status === "pending" && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      disabled={processing === request.id}
                      onClick={() =>
                        decideRequest(request.id, "approved")
                      }
                      className="rounded-lg bg-[#1F6B45] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#185637] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processing === request.id
                        ? "Processing..."
                        : "Approve Reviewer Access"}
                    </button>

                    <button
                      disabled={processing === request.id}
                      onClick={() =>
                        decideRequest(request.id, "rejected")
                      }
                      className="rounded-lg border border-[#B42318] px-5 py-2.5 text-sm font-semibold text-[#B42318] hover:bg-[#FDECEA] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject Request
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
