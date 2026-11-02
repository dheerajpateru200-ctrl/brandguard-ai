
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Session = {
  token: string;
  email: string;
  role: string;
};

type BannedTerm = {
  id: number;
  term: string;
  reason: string;
  suggestion: string | null;
  severity: "high" | "medium" | "low";
  is_active: boolean;
};

type TermForm = {
  term: string;
  reason: string;
  suggestion: string;
  severity: "high" | "medium" | "low";
};

const EMPTY_FORM: TermForm = {
  term: "",
  reason: "",
  suggestion: "",
  severity: "medium",
};

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [terms, setTerms] = useState<BannedTerm[]>([]);
  const [form, setForm] = useState<TermForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: "Bearer " + (session?.token || ""),
    }),
    [session]
  );

  const loadTerms = useCallback(async (token: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/banned-terms", {
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load banned terms.");
      }

      setTerms(data.terms || []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load banned terms."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      let token = "";

      try {
        const raw = localStorage.getItem("bg_session");
        if (raw) token = JSON.parse(raw).token || "";
      } catch {
        token = "";
      }

      if (!token) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: "Bearer " + token,
          },
        });

        if (!response.ok) {
          localStorage.removeItem("bg_session");
          if (!cancelled) setReady(true);
          return;
        }

        const user = await response.json();

        if (cancelled) return;

        const currentSession: Session = {
          token,
          email: user.email,
          role: user.role,
        };

        setSession(currentSession);

        if (user.role !== "admin") {
          setError("Admin access required.");
        } else {
          await loadTerms(token);
        }
      } catch {
        if (!cancelled) {
          setError("Could not verify your account. Please log in again.");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadTerms]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function saveTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!session || session.role !== "admin") return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/banned-terms", {
        method: editingId === null ? "POST" : "PATCH",
        headers,
        body: JSON.stringify(
          editingId === null ? form : { ...form, id: editingId }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save the term.");
      }

      setNotice(
        editingId === null
          ? "Banned term added successfully."
          : "Banned term updated successfully."
      );

      resetForm();
      await loadTerms(session.token);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save the term."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(term: BannedTerm) {
    setEditingId(term.id);

    setForm({
      term: term.term,
      reason: term.reason,
      suggestion: term.suggestion || "",
      severity: term.severity,
    });

    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleActive(term: BannedTerm) {
    if (!session || session.role !== "admin") return;

    const action = term.is_active ? "retire" : "reactivate";

    if (
      !window.confirm(`Are you sure you want to ${action} "${term.term}"?`)
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/banned-terms", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id: term.id,
          is_active: !term.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Could not ${action} the term.`);
      }

      setNotice(
        `Term "${term.term}" ${
          term.is_active ? "retired" : "reactivated"
        } successfully.`
      );

      if (editingId === term.id) resetForm();

      await loadTerms(session.token);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `Could not ${action} the term.`
      );
    }
  }

  function logout() {
    localStorage.removeItem("bg_session");
    window.location.href = "/";
  }

  const filteredTerms = terms.filter((term) => {
    const query = search.toLowerCase();

    const matchesSearch =
      term.term.toLowerCase().includes(query) ||
      term.reason.toLowerCase().includes(query);

    return matchesSearch && (showInactive || term.is_active);
  });

  const activeCount = terms.filter((term) => term.is_active).length;
  const inactiveCount = terms.length - activeCount;

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#F5F6F7] p-8">
        Loading administrator access...
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#F5F6F7] px-4 py-16">
        <div className="mx-auto max-w-md rounded-lg border border-[#D5DBE2] bg-white p-6">
          <h1 className="font-doc text-3xl font-semibold">
            Admin login required
          </h1>

          <p className="mt-2 text-sm text-[#566372]">
            Log in to BrandGuard with your administrator account.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-md bg-[#1B3A57] px-4 py-2 text-sm font-semibold text-white"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  if (session.role !== "admin") {
    return (
      <main className="min-h-screen bg-[#F5F6F7] px-4 py-16">
        <div className="mx-auto max-w-md rounded-lg border border-[#D5DBE2] bg-white p-6">
          <h1 className="font-doc text-3xl font-semibold">
            Access denied
          </h1>

          <p className="mt-2 text-sm text-[#566372]">
            Admin access required. Your account does not have administrator
            permissions.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-md border border-[#D5DBE2] px-4 py-2 text-sm font-medium"
          >
            Back to BrandGuard
          </Link>

          <button
            onClick={logout}
            className="ml-2 rounded-md px-4 py-2 text-sm font-medium hover:bg-[#EEF1F4]"
          >
            Log out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F6F7] text-[#172230]">
      <header className="border-b border-[#D5DBE2] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div>
            <Link
              href="/"
              className="font-doc text-2xl font-semibold tracking-tight"
            >
              BrandGuard
            </Link>
            <p className="text-xs text-[#566372]">
              Brand governance administration
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/" className="font-medium hover:underline">
              Content review
            </Link>

            <Link href="/history" className="font-medium hover:underline">
              Review history
            </Link>

            <span className="rounded bg-[#DDF0E5] px-2 py-1 text-xs font-semibold text-[#17553A]">
              Administrator
            </span>

            <button
              onClick={logout}
              className="rounded-md border border-[#D5DBE2] px-3 py-1.5 font-medium hover:bg-[#EEF1F4]"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#566372]">
            Governance controls
          </p>

          <h1 className="mt-1 font-doc text-4xl font-semibold tracking-tight">
            Admin dashboard
          </h1>

          <p className="mt-2 text-sm text-[#566372]">
            Manage brand rules, approved facts, and reviewer permissions.
          </p>
        </div>

        {/* Admin navigation */}
        <section className="mb-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/reviewer-requests"
            className="rounded-xl border border-[#D5DBE2] bg-white p-5 transition hover:border-[#1B3A57] hover:shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Access management
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1B3A57]">
              Reviewer Access Requests →
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#566372]">
              View creator applications and approve or reject reviewer access.
            </p>
          </Link>

          <Link
            href="/admin/facts"
            className="rounded-xl border border-[#D5DBE2] bg-white p-5 transition hover:border-[#1B3A57] hover:shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Brand knowledge
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1B3A57]">
              Approved Facts →
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#566372]">
              Manage verified brand facts, their sources, owners, and expiry
              dates.
            </p>
          </Link>

          <Link
            href="/admin/users"
            className="rounded-xl border border-[#D5DBE2] bg-white p-5 transition hover:border-[#1B3A57] hover:shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Account management
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1B3A57]">
              User Management →
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#566372]">
              View registered users and manage Creator, Reviewer, and Admin
              roles.
            </p>
          </Link>

          <Link
            href="/admin/audit"
            className="rounded-xl border border-[#D5DBE2] bg-white p-5 transition hover:border-[#1B3A57] hover:shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Governance history
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1B3A57]">
              Audit Log →
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#566372]">
              Inspect administrative changes and reviewer decisions.
            </p>
          </Link>
        </section>

        <div className="mb-7 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[#D5DBE2] bg-white p-5">
            <p className="text-sm text-[#566372]">Total terms</p>
            <p className="mt-1 text-3xl font-semibold">{terms.length}</p>
          </div>

          <div className="rounded-lg border border-[#D5DBE2] bg-white p-5">
            <p className="text-sm text-[#566372]">Active terms</p>
            <p className="mt-1 text-3xl font-semibold text-[#17553A]">
              {activeCount}
            </p>
          </div>

          <div className="rounded-lg border border-[#D5DBE2] bg-white p-5">
            <p className="text-sm text-[#566372]">Retired terms</p>
            <p className="mt-1 text-3xl font-semibold text-[#566372]">
              {inactiveCount}
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-[#F1B5AE] bg-[#FDECEA] p-3 text-sm text-[#8A1C13]"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 rounded-md border border-[#B5DBC4] bg-[#DDF0E5] p-3 text-sm text-[#17553A]"
          >
            {notice}
          </div>
        )}

        <section className="mb-7 rounded-lg border border-[#D5DBE2] bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-doc text-2xl font-semibold">
                {editingId === null ? "Add a banned term" : "Edit banned term"}
              </h2>

              <p className="mt-1 text-sm text-[#566372]">
                Define the phrase, why it is restricted, and a safer
                alternative.
              </p>
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-[#D5DBE2] px-3 py-2 text-sm hover:bg-[#EEF1F4]"
              >
                Cancel editing
              </button>
            )}
          </div>

          <form onSubmit={saveTerm} className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="term" className="text-sm font-medium">
                Banned term *
              </label>

              <input
                id="term"
                required
                maxLength={150}
                value={form.term}
                onChange={(e) =>
                  setForm({ ...form, term: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-[#D5DBE2] p-2"
                placeholder="e.g. guaranteed results"
              />
            </div>

            <div>
              <label htmlFor="severity" className="text-sm font-medium">
                Severity
              </label>

              <select
                id="severity"
                value={form.severity}
                onChange={(e) =>
                  setForm({
                    ...form,
                    severity: e.target.value as TermForm["severity"],
                  })
                }
                className="mt-1 w-full rounded-md border border-[#D5DBE2] bg-white p-2"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="reason" className="text-sm font-medium">
                Reason *
              </label>

              <textarea
                id="reason"
                required
                maxLength={1000}
                rows={2}
                value={form.reason}
                onChange={(e) =>
                  setForm({ ...form, reason: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-[#D5DBE2] p-2"
                placeholder="Explain why this phrase should be flagged."
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="suggestion" className="text-sm font-medium">
                Suggested alternative
              </label>

              <input
                id="suggestion"
                maxLength={500}
                value={form.suggestion}
                onChange={(e) =>
                  setForm({ ...form, suggestion: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-[#D5DBE2] p-2"
                placeholder="A safer phrase to use instead (optional)"
              />
            </div>

            <div className="md:col-span-2">
              <button
                disabled={saving}
                type="submit"
                className="rounded-md bg-[#1B3A57] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#142C43] disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId === null
                    ? "Add banned term"
                    : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-[#D5DBE2] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D5DBE2] p-5">
            <div>
              <h2 className="font-doc text-2xl font-semibold">
                Banned terms
              </h2>

              <p className="mt-1 text-sm text-[#566372]">
                Search, edit, retire, or reactivate governance rules.
              </p>
            </div>

            <button
              onClick={() => session && loadTerms(session.token)}
              disabled={loading}
              className="rounded-md border border-[#D5DBE2] px-3 py-2 text-sm font-medium hover:bg-[#EEF1F4] disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#D5DBE2] p-5 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search terms or reasons..."
              className="min-w-0 flex-1 rounded-md border border-[#D5DBE2] p-2 text-sm"
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show retired terms
            </label>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-[#566372]">
              Loading banned terms...
            </p>
          ) : filteredTerms.length === 0 ? (
            <p className="p-6 text-sm text-[#566372]">
              No matching banned terms found.
            </p>
          ) : (
            <div className="divide-y divide-[#E4E9EE]">
              {filteredTerms.map((term) => (
                <article key={term.id} className="p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{term.term}</h3>

                        <span
                          className={
                            "rounded px-2 py-0.5 text-xs font-semibold " +
                            (term.severity === "high"
                              ? "bg-[#FDECEA] text-[#8A1C13]"
                              : term.severity === "medium"
                                ? "bg-[#FCF1DC] text-[#7A4505]"
                                : "bg-[#E6F0FA] text-[#164A82]")
                          }
                        >
                          {term.severity} severity
                        </span>

                        <span
                          className={
                            "rounded px-2 py-0.5 text-xs font-semibold " +
                            (term.is_active
                              ? "bg-[#DDF0E5] text-[#17553A]"
                              : "bg-[#E4E9EE] text-[#566372]")
                          }
                        >
                          {term.is_active ? "Active" : "Retired"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm">{term.reason}</p>

                      {term.suggestion && (
                        <p className="mt-2 text-sm text-[#566372]">
                          <span className="font-medium text-[#172230]">
                            Suggested alternative:
                          </span>{" "}
                          {term.suggestion}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => startEdit(term)}
                        className="rounded-md border border-[#D5DBE2] px-3 py-1.5 text-sm font-medium hover:bg-[#EEF1F4]"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => toggleActive(term)}
                        className={
                          "rounded-md px-3 py-1.5 text-sm font-medium " +
                          (term.is_active
                            ? "border border-[#B42318] text-[#8A1C13] hover:bg-[#FDECEA]"
                            : "border border-[#1F6B45] text-[#17553A] hover:bg-[#DDF0E5]")
                        }
                      >
                        {term.is_active ? "Retire" : "Reactivate"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="mt-5 text-xs text-[#566372]">
          Changes are sent to the server and restricted to accounts with the
          admin role.
        </p>
      </div>
    </main>
  );
}
