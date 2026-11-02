
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
      return "bg-green-100 text-green-800";
    }

    if (status === "rejected") {
      return "bg-red-100 text-red-800";
    }

    return "bg-amber-100 text-amber-800";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f7f4] p-8 text-[#252525]">
        Loading Reviewer access...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-5 py-10 text-[#252525]">
      <div className="mx-auto max-w-3xl">
        <a
          href="/"
          className="text-sm text-[#666] hover:text-black"
        >
          ← Back to dashboard
        </a>

        <header className="mb-8 mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#777]">
            Account permissions
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Request Reviewer Access
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-[#666]">
            Request permission to review submitted brand content.
            An administrator will review your request before granting
            additional permissions.
          </p>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {allowed && (
          <>
            <section className="rounded-2xl border border-[#e5e3dc] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">
                Why do you need Reviewer access?
              </h2>

              <p className="mt-2 text-sm text-[#777]">
                Explain your experience and why you should be allowed
                to review brand submissions.
              </p>

              <form onSubmit={submitRequest} className="mt-6">
                <label
                  htmlFor="reason"
                  className="mb-2 block text-sm font-medium"
                >
                  Your explanation
                </label>

                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  disabled={hasPending || submitting}
                  placeholder="I would like Reviewer access because..."
                  className="w-full rounded-xl border border-[#deded8] bg-[#fcfcfa] p-4 text-sm outline-none focus:border-[#777] disabled:opacity-60"
                />

                <div className="mt-2 flex justify-between text-xs text-[#888]">
                  <span>Minimum 20 characters</span>
                  <span>{reason.length}/1000</span>
                </div>

                <button
                  type="submit"
                  disabled={hasPending || submitting}
                  className="mt-5 rounded-xl bg-[#242424] px-6 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Submitting..."
                    : hasPending
                      ? "Request Pending"
                      : "Submit Access Request"}
                </button>
              </form>
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-semibold">
                Your request history
              </h2>

              <div className="mt-4 space-y-3">
                {requests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#d8d6cf] p-6 text-center text-sm text-[#888]">
                    You haven't submitted a Reviewer access request yet.
                  </div>
                ) : (
                  requests.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-xl border border-[#e5e3dc] bg-white p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          Request #{request.id}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(request.status)}`}
                        >
                          {request.status}
                        </span>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#666]">
                        {request.reason}
                      </p>

                      <p className="mt-3 text-xs text-[#999]">
                        Submitted:{" "}
                        {new Date(request.created_at).toLocaleString()}
                      </p>
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
