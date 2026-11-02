
"use client";

import { useEffect, useState } from "react";

type ReviewerRequest = {
  id: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
};

export default function ReviewerAccessPage() {
  const [token, setToken] = useState("");
  const [reason, setReason] = useState("");
  const [requests, setRequests] = useState<ReviewerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function initialize() {
      const saved = localStorage.getItem("bg_session");

      if (!saved) {
        setError("Please log in to continue.");
        setLoading(false);
        return;
      }

      try {
        const session = JSON.parse(saved);
        if (!session.token) throw new Error("Invalid session.");

        setToken(session.token);

        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        });

        const user = await response.json();

        if (!response.ok) {
          throw new Error(user.error || "Could not verify your account.");
        }

        if (user.role !== "creator") {
          setError("Only Creator accounts can request Reviewer access.");
          setLoading(false);
          return;
        }

        setAllowed(true);
        await loadRequests(session.token);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  async function loadRequests(accessToken: string) {
    const response = await fetch("/api/reviewer-requests", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load requests.");
    }

    setRequests(data.requests || []);
  }

  async function submitRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (reason.trim().length < 20) {
      setError("Please provide at least 20 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/reviewer-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not submit your request.");
      }

      setMessage("Your Reviewer access request has been submitted.");
      setReason("");
      await loadRequests(token);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const hasPending = requests.some(
    (request) => request.status === "pending"
  );

  function statusStyle(status: ReviewerRequest["status"]) {
    if (status === "approved") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (status === "rejected") {
      return "border-rose-200 bg-rose-50 text-rose-700";
    }

    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f1f5ff] via-[#f8f9fc] to-[#f5f0ff] px-5 text-[#344054]">
        <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-6 py-5 shadow-lg shadow-blue-100/40 backdrop-blur">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-[#315efb]" />
          <span className="text-sm font-medium">
            Loading your access details...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-gradient-to-br from-[#f1f5ff] via-[#f8f9fc] to-[#f5f0ff] px-4 py-8 text-[#172033] sm:px-6 sm:py-12">

      {/* Decorative background glows */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="absolute -right-32 top-40 h-[28rem] w-[28rem] rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 rounded-full bg-indigo-200/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl">

        {/* Back navigation */}
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#315efb]"
        >
          <span aria-hidden="true">←</span>
          Back to dashboard
        </a>

        {/* Page heading */}
        <header className="mb-8 mt-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 shadow-sm backdrop-blur">
            <span>✦</span>
            Account permissions
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-[#172033] sm:text-4xl">
            Request Reviewer Access
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667085] sm:text-base">
            Take the next step in maintaining brand quality. Request
            permission to review submitted content. An administrator
            will assess your request before granting access.
          </p>
        </header>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/95 p-4 text-sm text-rose-800 shadow-sm"
          >
            <span className="text-lg">!</span>
            <p className="leading-6">{error}</p>
          </div>
        )}

        {/* Success message */}
        {message && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/95 p-4 text-sm text-emerald-800 shadow-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold">
              ✓
            </span>
            <div>
              <p className="font-semibold">Request submitted successfully</p>
              <p className="mt-1 leading-6">{message}</p>
            </div>
          </div>
        )}

        {allowed && (
          <>
            {/* Pending status */}
            {hasPending && (
              <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200/80 bg-white/90 shadow-lg shadow-amber-100/30 backdrop-blur">
                <div className="flex items-start gap-4 p-5 sm:p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl">
                    ⏳
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-[#172033]">
                        Your request is under review
                      </h2>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Pending
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#667085]">
                      Your request has been received. An administrator
                      needs to review it before Reviewer permissions can
                      be granted. You can check its progress below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Request form */}
            <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(49,94,251,0.08)] backdrop-blur-xl transition-shadow hover:shadow-[0_16px_48px_rgba(49,94,251,0.12)] sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl">
                  🛡️
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-[#172033] sm:text-xl">
                    Why do you need Reviewer access?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#667085]">
                    Explain your experience and why you should be allowed
                    to review brand submissions.
                  </p>
                </div>
              </div>

              <form onSubmit={submitRequest} className="mt-7">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="reason"
                    className="text-sm font-semibold text-[#344054]"
                  >
                    Your explanation
                  </label>
                  <span className="text-xs text-[#98a2b3]">
                    Required
                  </span>
                </div>

                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={6}
                  maxLength={1000}
                  disabled={hasPending || submitting}
                  placeholder="Describe your experience with brand guidelines, content quality, reviewing submissions, or why you are interested in this responsibility..."
                  className="w-full resize-y rounded-xl border border-[#dfe4ec] bg-white/80 px-4 py-4 text-sm leading-7 text-[#344054] outline-none transition placeholder:text-[#a0a8b5] hover:border-[#b8c4d6] focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70"
                />

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className={reason.trim().length < 20 ? "text-[#98a2b3]" : "font-medium text-emerald-600"}>
                    {reason.trim().length < 20
                      ? `${Math.max(0, 20 - reason.trim().length)} more characters required`
                      : "✓ Minimum length reached"}
                  </span>
                  <span className="tabular-nums text-[#98a2b3]">
                    {reason.length}/1000
                  </span>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-[#eef0f4] pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-[#98a2b3]">
                    Your request will be reviewed by an administrator.
                  </p>

                  <button
                    type="submit"
                    disabled={hasPending || submitting || reason.trim().length < 20}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#315efb] to-[#6548e8] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:translate-y-0 disabled:cursor-not-allowed disabled:from-[#aab4c8] disabled:to-[#aab4c8] disabled:shadow-none"
                  >
                    {submitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Submitting...
                      </>
                    ) : hasPending ? (
                      "Request Pending"
                    ) : (
                      <>
                        Submit Access Request
                        <span aria-hidden="true">→</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* Request history */}
            <section className="mt-10">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#98a2b3]">
                    Activity
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-[#172033]">
                    Your request history
                  </h2>
                </div>
                <span className="rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-[#667085] shadow-sm backdrop-blur">
                  {requests.length} {requests.length === 1 ? "request" : "requests"}
                </span>
              </div>

              <div className="space-y-4">
                {requests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white/75 px-6 py-12 text-center shadow-sm backdrop-blur">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f5fa] text-2xl">
                      📋
                    </div>
                    <h3 className="mt-4 font-semibold text-[#344054]">
                      No requests yet
                    </h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#98a2b3]">
                      When you submit a Reviewer access request, its status
                      and submission details will appear here.
                    </p>
                  </div>
                ) : (
                  requests.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_5px_22px_rgba(16,24,40,0.05)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-[#98a2b3]">
                            REVIEW REQUEST
                          </p>
                          <h3 className="mt-1 font-semibold text-[#172033]">
                            Request #{request.id}
                          </h3>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${statusStyle(request.status)}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {request.status}
                        </span>
                      </div>

                      <div className="mt-5 rounded-xl border border-[#edf0f5] bg-[#f8f9fc]/90 p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#98a2b3]">
                          Your explanation
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-7 text-[#475467]">
                          {request.reason}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#98a2b3]">
                        <span>
                          Submitted: {formatDate(request.created_at)}
                        </span>
                        {request.reviewed_at && (
                          <span>
                            Reviewed: {formatDate(request.reviewed_at)}
                          </span>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
