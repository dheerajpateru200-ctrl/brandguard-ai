
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

const inputClass =
  "mt-1 w-full rounded-xl border border-indigo-100 bg-white/80 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

const cardClass =
  "rounded-2xl border border-white/80 bg-white/80 shadow-[0_8px_30px_rgba(59,80,160,0.07)] backdrop-blur-xl";

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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 p-8 text-slate-600">
        <div className={`${cardClass} rounded-2xl px-8 py-6`}>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            Loading administrator access...
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-16">
        <div className={`${cardClass} w-full max-w-md rounded-2xl p-7`}>
          <h1 className="font-doc text-3xl font-semibold text-slate-900">
            Admin login required
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Log in to BrandGuard with your administrator account.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  if (session.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-16">
        <div className={`${cardClass} w-full max-w-md rounded-2xl p-7`}>
          <h1 className="font-doc text-3xl font-semibold text-slate-900">
            Access denied
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Admin access required. Your account does not have administrator
            permissions.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-indigo-50"
          >
            Back to BrandGuard
          </Link>

          <button
            onClick={logout}
            className="ml-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#f8faff] to-[#ede9fe] text-[#172554]">
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
            <Link
              href="/"
              className="font-doc text-2xl font-semibold tracking-tight text-slate-900"
            >
              BrandGuard
            </Link>
            <p className="text-xs text-slate-500">
              Brand governance administration
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/"
              className="font-medium text-slate-700 transition hover:text-indigo-700"
            >
              Content review
            </Link>

            <Link
              href="/history"
              className="font-medium text-slate-700 transition hover:text-indigo-700"
            >
              Review history
            </Link>

            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              Administrator
            </span>

            <button
              onClick={logout}
              className="rounded-xl border border-indigo-100 bg-white/80 px-4 py-2 font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 md:px-6">
        {/* Dashboard heading */}
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Governance controls
          </p>

          <h1 className="mt-2 font-doc text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Admin dashboard
          </h1>

          <p className="mt-3 text-base text-slate-600">
            Manage brand rules, approved facts, and reviewer permissions.
          </p>
        </div>

        {/* Admin navigation */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/reviewer-requests"
            className="group rounded-2xl border border-white/80 bg-white/80 p-6 shadow-[0_8px_30px_rgba(59,80,160,0.07)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:bg-white hover:shadow-[0_16px_40px_rgba(59,80,160,0.14)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-700 transition group-hover:scale-110">
              <span aria-hidden="true">♙</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Access management
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Reviewer Access Requests →
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              View creator applications and approve or reject reviewer access.
            </p>
          </Link>

          <Link
            href="/admin/facts"
            className="group rounded-2xl border border-white/80 bg-white/80 p-6 shadow-[0_8px_30px_rgba(59,80,160,0.07)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:bg-white hover:shadow-[0_16px_40px_rgba(59,80,160,0.14)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl text-violet-700 transition group-hover:scale-110">
              <span aria-hidden="true">▤</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
              Brand knowledge
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Approved Facts →
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Manage verified brand facts, their sources, owners, and expiry
              dates.
            </p>
          </Link>

          <Link
            href="/admin/users"
            className="group rounded-2xl border border-white/80 bg-white/80 p-6 shadow-[0_8px_30px_rgba(59,80,160,0.07)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-[0_16px_40px_rgba(59,80,160,0.14)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700 transition group-hover:scale-110">
              <span aria-hidden="true">♧</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Account management
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              User Management →
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              View registered users and manage Creator, Reviewer, and Admin
              roles.
            </p>
          </Link>

          <Link
            href="/admin/audit"
            className="group rounded-2xl border border-white/80 bg-white/80 p-6 shadow-[0_8px_30px_rgba(59,80,160,0.07)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:bg-white hover:shadow-[0_16px_40px_rgba(59,80,160,0.14)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-2xl text-purple-700 transition group-hover:scale-110">
              <span aria-hidden="true">⌕</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-purple-700">
              Governance history
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Audit Log →
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Inspect administrative changes and reviewer decisions.
            </p>
          </Link>

          <Link
            href="/admin/insights"
            className="group rounded-2xl border border-white/80 bg-white/80 p-6 shadow-[0_8px_30px_rgba(59,80,160,0.07)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-[0_16px_40px_rgba(59,80,160,0.14)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-2xl text-teal-700 transition group-hover:scale-110">
              <span aria-hidden="true">▥</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Analytics & reporting
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Insights Dashboard →
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Explore submission trends, review decisions, AI findings, and
              reviewer activity.
            </p>
          </Link>
        </section>

        {/* Statistics */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className={`${cardClass} p-6 transition hover:-translate-y-1`}>
            <p className="text-sm font-medium text-slate-500">Total terms</p>
            <p className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              {terms.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              All governance rules
            </p>
          </div>

          <div className={`${cardClass} p-6 transition hover:-translate-y-1`}>
            <p className="text-sm font-medium text-slate-500">Active terms</p>
            <p className="mt-2 text-4xl font-bold tracking-tight text-emerald-600">
              {activeCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Currently enforced rules
            </p>
          </div>

          <div className={`${cardClass} p-6 transition hover:-translate-y-1`}>
            <p className="text-sm font-medium text-slate-500">Retired terms</p>
            <p className="mt-2 text-4xl font-bold tracking-tight text-slate-500">
              {inactiveCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Inactive governance rules
            </p>
          </div>
        </section>

        {/* Alerts */}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800 shadow-sm"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-800 shadow-sm"
          >
            {notice}
          </div>
        )}

        {/* Add or edit banned term */}
        <section className={`${cardClass} mb-8 p-6 md:p-8`}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Brand rule configuration
              </p>

              <h2 className="mt-2 font-doc text-2xl font-bold text-slate-900">
                {editingId === null ? "Add a banned term" : "Edit banned term"}
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Define the phrase, why it is restricted, and a safer
                alternative.
              </p>
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-indigo-100 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-indigo-50"
              >
                Cancel editing
              </button>
            )}
          </div>

          <form onSubmit={saveTerm} className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="term"
                className="text-sm font-semibold text-slate-700"
              >
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
                className={inputClass}
                placeholder="e.g. guaranteed results"
              />
            </div>

            <div>
              <label
                htmlFor="severity"
                className="text-sm font-semibold text-slate-700"
              >
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
                className={inputClass}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="reason"
                className="text-sm font-semibold text-slate-700"
              >
                Reason *
              </label>

              <textarea
                id="reason"
                required
                maxLength={1000}
                rows={3}
                value={form.reason}
                onChange={(e) =>
                  setForm({ ...form, reason: e.target.value })
                }
                className={inputClass}
                placeholder="Explain why this phrase should be flagged."
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="suggestion"
                className="text-sm font-semibold text-slate-700"
              >
                Suggested alternative
              </label>

              <input
                id="suggestion"
                maxLength={500}
                value={form.suggestion}
                onChange={(e) =>
                  setForm({ ...form, suggestion: e.target.value })
                }
                className={inputClass}
                placeholder="A safer phrase to use instead (optional)"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button
                disabled={saving}
                type="submit"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId === null
                    ? "Add banned term"
                    : "Save changes"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Banned terms list */}
        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/70 p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Governance rules
              </p>

              <h2 className="mt-2 font-doc text-2xl font-bold text-slate-900">
                Banned terms
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Search, edit, retire, or reactivate governance rules.
              </p>
            </div>

            <button
              onClick={() => session && loadTerms(session.token)}
              disabled={loading}
              className="rounded-xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>

          <div className="flex flex-col gap-3 border-b border-indigo-100/70 p-5 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search terms or reasons..."
              className="min-w-0 flex-1 rounded-xl border border-indigo-100 bg-white/80 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              Show retired terms
            </label>
          </div>

          {loading ? (
            <p className="p-8 text-sm text-slate-500">
              Loading banned terms...
            </p>
          ) : filteredTerms.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-500">
                ◇
              </div>
              <p className="font-semibold text-slate-800">
                No matching banned terms found.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try another search or add a new governance rule.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-indigo-100/70">
              {filteredTerms.map((term) => (
                <article
                  key={term.id}
                  className="p-5 transition hover:bg-indigo-50/40 md:p-6"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {term.term}
                        </h3>

                        <span
                          className={
                            "rounded-full px-3 py-1 text-xs font-semibold " +
                            (term.severity === "high"
                              ? "bg-red-100 text-red-700"
                              : term.severity === "medium"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-700")
                          }
                        >
                          {term.severity} severity
                        </span>

                        <span
                          className={
                            "rounded-full px-3 py-1 text-xs font-semibold " +
                            (term.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600")
                          }
                        >
                          {term.is_active ? "Active" : "Retired"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {term.reason}
                      </p>

                      {term.suggestion && (
                        <p className="mt-3 rounded-xl bg-emerald-50/80 p-3 text-sm leading-6 text-emerald-800">
                          <span className="font-semibold">
                            Suggested alternative:
                          </span>{" "}
                          {term.suggestion}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => startEdit(term)}
                        className="rounded-xl border border-indigo-100 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => toggleActive(term)}
                        className={
                          "rounded-xl px-4 py-2 text-sm font-semibold transition " +
                          (term.is_active
                            ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                            : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50")
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

        <footer className="mt-7 pb-5 text-center text-xs text-slate-500">
          BrandGuard Governance · Changes are restricted to administrator
          accounts.
        </footer>
      </div>
    </main>
  );
}
