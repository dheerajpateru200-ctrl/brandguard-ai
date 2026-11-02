
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Session = {
  token: string;
  email: string;
  role: string;
};

type ApprovedFact = {
  id: number;
  fact: string;
  source: string;
  owner: string;
  expires_on: string;
  is_active: boolean;
};

type FactForm = {
  fact: string;
  source: string;
  owner: string;
  expires_on: string;
};

const EMPTY_FORM: FactForm = {
  fact: "",
  source: "",
  owner: "",
  expires_on: "",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

const cardClass =
  "rounded-2xl border border-white/70 bg-white/75 shadow-[0_8px_30px_rgba(55,65,120,0.07)] backdrop-blur-xl";

export default function ApprovedFactsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("");
  const [facts, setFacts] = useState<ApprovedFact[]>([]);
  const [form, setForm] = useState<FactForm>(EMPTY_FORM);
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

  const loadFacts = useCallback(async (token: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/approved-facts", {
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load approved facts.");
      }

      setFacts(data.facts || []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load approved facts."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setToday(new Date().toISOString().slice(0, 10));

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
          await loadFacts(token);
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
  }, [loadFacts]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function saveFact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!session || session.role !== "admin") return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/approved-facts", {
        method: editingId === null ? "POST" : "PATCH",
        headers,
        body: JSON.stringify(
          editingId === null ? form : { ...form, id: editingId }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save the fact.");
      }

      setNotice(
        editingId === null
          ? "Approved fact added successfully."
          : "Approved fact updated successfully."
      );

      resetForm();
      await loadFacts(session.token);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save the fact."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(fact: ApprovedFact) {
    setEditingId(fact.id);

    setForm({
      fact: fact.fact,
      source: fact.source,
      owner: fact.owner,
      expires_on: fact.expires_on,
    });

    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleActive(fact: ApprovedFact) {
    if (!session || session.role !== "admin") return;

    const action = fact.is_active ? "retire" : "reactivate";

    if (!window.confirm(`Are you sure you want to ${action} this fact?`)) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/approved-facts", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id: fact.id,
          is_active: !fact.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Could not ${action} the fact.`);
      }

      setNotice(
        `Approved fact ${action === "retire" ? "retired" : "reactivated"} successfully.`
      );

      if (editingId === fact.id) resetForm();

      await loadFacts(session.token);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `Could not ${action} the fact.`
      );
    }
  }

  function logout() {
    localStorage.removeItem("bg_session");
    window.location.href = "/";
  }

  const activeFacts = facts.filter((fact) => fact.is_active);

  const expiredFacts = activeFacts.filter(
    (fact) => today !== "" && fact.expires_on < today
  );

  const inactiveCount = facts.length - activeFacts.length;

  const filteredFacts = facts.filter((fact) => {
    const query = search.toLowerCase();

    const matchesSearch =
      fact.fact.toLowerCase().includes(query) ||
      fact.source.toLowerCase().includes(query) ||
      fact.owner.toLowerCase().includes(query);

    return matchesSearch && (showInactive || fact.is_active);
  });

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 p-8">
        <div className={`${cardClass} rounded-2xl px-8 py-6 text-sm font-medium text-slate-600`}>
          <span className="mr-2 inline-block animate-spin">◌</span>
          Loading administrator access...
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-16">
        <div className={`${cardClass} w-full max-w-md p-8`}>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl text-white shadow-lg shadow-indigo-200">
            ✦
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Admin login required
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Log in to BrandGuard with your administrator account to manage
            approved brand facts.
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Go to login →
          </Link>
        </div>
      </main>
    );
  }

  if (session.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-16">
        <div className={`${cardClass} w-full max-w-md p-8`}>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl text-red-600">
            !
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Access denied
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Admin access required. Your account does not have administrator
            permissions.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200"
            >
              Back to BrandGuard
            </Link>

            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#f8faff] to-[#ede9fe] text-slate-800">
      {/* Decorative background */}
      <div className="pointer-events-none fixed -left-32 top-32 h-96 w-96 rounded-full bg-blue-300/20 blur-3xl" />
      <div className="pointer-events-none fixed -right-32 top-10 h-96 w-96 rounded-full bg-violet-300/25 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-200/20 blur-3xl" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl font-bold text-white shadow-lg shadow-indigo-200"
            >
              B
            </Link>

            <div>
              <Link
                href="/"
                className="text-xl font-bold tracking-tight text-slate-900"
              >
                BrandGuard
              </Link>
              <p className="text-xs text-slate-500">
                Approved facts management
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/admin"
              className="rounded-xl px-3 py-2 font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
            >
              Banned terms
            </Link>

            <Link
              href="/"
              className="rounded-xl px-3 py-2 font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
            >
              Content review
            </Link>

            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              ● Administrator
            </span>

            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        {/* Page heading */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 shadow-sm">
              <span>✦</span>
              Governance controls
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
              Approved facts
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 md:text-base">
              Manage verified brand information, sources, owners and expiry
              dates in one place.
            </p>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
            <p className="text-xs font-medium text-slate-400">Your role</p>
            <p className="mt-1 font-semibold text-slate-800">
              Administrator
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${cardClass} p-5 transition duration-200 hover:-translate-y-1 hover:shadow-xl`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Total facts</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-lg text-indigo-700">
                ◈
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              {facts.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">All recorded facts</p>
          </div>

          <div className={`${cardClass} p-5 transition duration-200 hover:-translate-y-1 hover:shadow-xl`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Active facts</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-lg text-emerald-700">
                ✓
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-emerald-700">
              {activeFacts.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">Currently active</p>
          </div>

          <div className={`${cardClass} p-5 transition duration-200 hover:-translate-y-1 hover:shadow-xl`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Expired facts</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-lg text-red-600">
                !
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-red-600">
              {expiredFacts.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">Past expiry date</p>
          </div>

          <div className={`${cardClass} p-5 transition duration-200 hover:-translate-y-1 hover:shadow-xl`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Retired facts</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-600">
                ◷
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-600">
              {inactiveCount}
            </p>
            <p className="mt-1 text-xs text-slate-400">Inactive records</p>
          </div>
        </div>

        {/* Error and success messages */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-700 shadow-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-100 font-bold">
              !
            </span>
            <p className="pt-1">{error}</p>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-700 shadow-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold">
              ✓
            </span>
            <p className="pt-1">{notice}</p>
          </div>
        )}

        {/* Add / Edit form */}
        <section className={`${cardClass} mb-8 overflow-hidden`}>
          <div className="border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 px-5 py-5 md:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl text-white shadow-md shadow-indigo-200">
                  {editingId === null ? "+" : "✎"}
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {editingId === null
                      ? "Add an approved fact"
                      : "Edit approved fact"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Record verified information and its responsible owner.
                  </p>
                </div>
              </div>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel editing
                </button>
              )}
            </div>
          </div>

          <form onSubmit={saveFact} className="grid gap-5 p-5 md:grid-cols-2 md:p-7">
            <div className="md:col-span-2">
              <label
                htmlFor="fact"
                className="text-sm font-semibold text-slate-700"
              >
                Approved fact <span className="text-red-500">*</span>
              </label>

              <textarea
                id="fact"
                required
                maxLength={2000}
                rows={4}
                value={form.fact}
                onChange={(e) =>
                  setForm({ ...form, fact: e.target.value })
                }
                className={inputClass + " resize-y"}
                placeholder="Enter the verified brand statement..."
              />

              <p className="mt-1.5 text-right text-xs text-slate-400">
                {form.fact.length}/2000 characters
              </p>
            </div>

            <div>
              <label
                htmlFor="source"
                className="text-sm font-semibold text-slate-700"
              >
                Source <span className="text-red-500">*</span>
              </label>

              <input
                id="source"
                required
                maxLength={1000}
                value={form.source}
                onChange={(e) =>
                  setForm({ ...form, source: e.target.value })
                }
                className={inputClass}
                placeholder="e.g. Official product documentation"
              />
            </div>

            <div>
              <label
                htmlFor="owner"
                className="text-sm font-semibold text-slate-700"
              >
                Owner <span className="text-red-500">*</span>
              </label>

              <input
                id="owner"
                required
                maxLength={150}
                value={form.owner}
                onChange={(e) =>
                  setForm({ ...form, owner: e.target.value })
                }
                className={inputClass}
                placeholder="Person or department responsible"
              />
            </div>

            <div>
              <label
                htmlFor="expires_on"
                className="text-sm font-semibold text-slate-700"
              >
                Expiry date <span className="text-red-500">*</span>
              </label>

              <input
                id="expires_on"
                type="date"
                required
                min={today || undefined}
                value={form.expires_on}
                onChange={(e) =>
                  setForm({ ...form, expires_on: e.target.value })
                }
                className={inputClass + " bg-white"}
              />

              <p className="mt-1.5 text-xs text-slate-400">
                Set the date until which this fact remains valid.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <button
                disabled={saving}
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId === null
                    ? "+ Add approved fact"
                    : "Save changes"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Clear form
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Facts list */}
        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-100/70 bg-white/50 p-5 md:px-7">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Brand facts
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search, edit, retire and reactivate approved facts.
              </p>
            </div>

            <button
              onClick={() => session && loadFacts(session.token)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-60"
            >
              <span className={loading ? "animate-spin" : ""}>↻</span>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Search and filters */}
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-white/40 p-5 md:flex-row md:items-center md:px-7">
            <div className="relative min-w-0 flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                ⌕
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search facts, sources or owners..."
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-indigo-50">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              Show retired facts
            </label>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 md:px-7">
            <p className="text-xs font-medium text-slate-400">
              Showing {filteredFacts.length} of {facts.length} facts
            </p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Clear search
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
              <p className="text-sm font-medium text-slate-600">
                Loading approved facts...
              </p>
            </div>
          ) : filteredFacts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl text-indigo-500">
                ◈
              </div>
              <h3 className="font-semibold text-slate-800">
                No matching approved facts
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Try changing your search or adding a new approved fact.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredFacts.map((fact) => {
                const expired =
                  today !== "" && fact.expires_on < today;

                return (
                  <article
                    key={fact.id}
                    className="p-5 transition duration-200 hover:bg-indigo-50/30 md:px-7"
                  >
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span
                            className={
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold " +
                              (fact.is_active
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200")
                            }
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {fact.is_active ? "Active" : "Retired"}
                          </span>

                          {fact.is_active && (
                            <span
                              className={
                                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold " +
                                (expired
                                  ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                                  : "bg-blue-50 text-blue-700 ring-1 ring-blue-200")
                              }
                            >
                              {expired ? "⚠ Expired" : "✓ Valid"}
                            </span>
                          )}
                        </div>

                        <h3 className="whitespace-pre-wrap break-words text-base font-semibold leading-7 text-slate-900">
                          {fact.fact}
                        </h3>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-xl border border-slate-100 bg-white/70 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Source
                            </p>
                            <p className="mt-1 break-words text-sm font-medium text-slate-700">
                              {fact.source}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-100 bg-white/70 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Owner
                            </p>
                            <p className="mt-1 break-words text-sm font-medium text-slate-700">
                              {fact.owner}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-100 bg-white/70 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Expires on
                            </p>
                            <p
                              className={
                                "mt-1 text-sm font-semibold " +
                                (expired && fact.is_active
                                  ? "text-red-600"
                                  : "text-slate-700")
                              }
                            >
                              {fact.expires_on}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                        <button
                          onClick={() => startEdit(fact)}
                          className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                        >
                          ✎ Edit
                        </button>

                        <button
                          onClick={() => toggleActive(fact)}
                          className={
                            "rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition " +
                            (fact.is_active
                              ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                              : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50")
                          }
                        >
                          {fact.is_active ? "Retire" : "Reactivate"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer note */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-white/55 p-4 text-xs leading-6 text-slate-500 backdrop-blur-xl">
          <span className="mt-0.5 text-base text-indigo-500">ⓘ</span>
          <p>
            Only administrator accounts can manage approved facts. Expiry
            labels are informational; the review API must also exclude expired
            facts.
          </p>
        </div>
      </div>
    </main>
  );
}
