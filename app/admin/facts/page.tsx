
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
          editingId === null
            ? form
            : { ...form, id: editingId }
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
            Admin access required. Your account does not have administrator permissions.
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
            <Link href="/" className="font-doc text-2xl font-semibold">
              BrandGuard
            </Link>

            <p className="text-xs text-[#566372]">
              Approved facts management
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/admin" className="font-medium hover:underline">
              Banned terms
            </Link>

            <Link href="/" className="font-medium hover:underline">
              Content review
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
            Approved facts
          </h1>

          <p className="mt-2 text-sm text-[#566372]">
            Manage verified brand information, sources, owners and expiry dates.
          </p>
        </div>

        <div className="mb-7 grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-[#D5DBE2] bg-white p-5">
            <p className="text-sm text-[#566372]">Total facts</p>
            <p className="mt-1 text-3xl font-semibold">{facts.length}</p>
          </div>

          <div className="rounded-lg border border-[#D5DBE2] bg-white p-5">
            <p className="text-sm text-[#566372]">Active facts</p>
            <p className="mt-1 text-3xl font-semibold text-[#17553A]">
              {activeFacts.length}
            </p>
          </div>

          <div className="rounded-lg border border-[#D5DBE2] bg-white p-5">
            <p className="text-sm text-[#566372]">Expired facts</p>
            <p className="mt-1 text-3xl font-semibold text-[#B42318]">
              {expiredFacts.length}
            </p>
          </div>

          <div className="rounded-lg border border-[#D5DBE2] bg-white p-5">
            <p className="text-sm text-[#566372]">Retired facts</p>
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
                {editingId === null ? "Add an approved fact" : "Edit approved fact"}
              </h2>

              <p className="mt-1 text-sm text-[#566372]">
                Record verified information and who is responsible for it.
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

          <form onSubmit={saveFact} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="fact" className="text-sm font-medium">
                Approved fact *
              </label>

              <textarea
                id="fact"
                required
                maxLength={2000}
                rows={3}
                value={form.fact}
                onChange={(e) =>
                  setForm({ ...form, fact: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-[#D5DBE2] p-2"
                placeholder="Enter the verified brand statement."
              />
            </div>

            <div>
              <label htmlFor="source" className="text-sm font-medium">
                Source *
              </label>

              <input
                id="source"
                required
                maxLength={1000}
                value={form.source}
                onChange={(e) =>
                  setForm({ ...form, source: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-[#D5DBE2] p-2"
                placeholder="e.g. Official product documentation"
              />
            </div>

            <div>
              <label htmlFor="owner" className="text-sm font-medium">
                Owner *
              </label>

              <input
                id="owner"
                required
                maxLength={150}
                value={form.owner}
                onChange={(e) =>
                  setForm({ ...form, owner: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-[#D5DBE2] p-2"
                placeholder="Person or department responsible"
              />
            </div>

            <div>
              <label htmlFor="expires_on" className="text-sm font-medium">
                Expiry date *
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
                className="mt-1 w-full rounded-md border border-[#D5DBE2] bg-white p-2"
              />
            </div>

            <div className="flex items-end">
              <button
                disabled={saving}
                type="submit"
                className="rounded-md bg-[#1B3A57] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#142C43] disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId === null
                    ? "Add approved fact"
                    : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-[#D5DBE2] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D5DBE2] p-5">
            <div>
              <h2 className="font-doc text-2xl font-semibold">
                Brand facts
              </h2>

              <p className="mt-1 text-sm text-[#566372]">
                Search, edit, retire and reactivate approved facts.
              </p>
            </div>

            <button
              onClick={() => session && loadFacts(session.token)}
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
              placeholder="Search facts, sources or owners..."
              className="min-w-0 flex-1 rounded-md border border-[#D5DBE2] p-2 text-sm"
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show retired facts
            </label>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-[#566372]">
              Loading approved facts...
            </p>
          ) : filteredFacts.length === 0 ? (
            <p className="p-6 text-sm text-[#566372]">
              No matching approved facts found.
            </p>
          ) : (
            <div className="divide-y divide-[#E4E9EE]">
              {filteredFacts.map((fact) => {
                const expired =
                  today !== "" && fact.expires_on < today;

                return (
                  <article key={fact.id} className="p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={
                              "rounded px-2 py-0.5 text-xs font-semibold " +
                              (fact.is_active
                                ? "bg-[#DDF0E5] text-[#17553A]"
                                : "bg-[#E4E9EE] text-[#566372]")
                            }
                          >
                            {fact.is_active ? "Active" : "Retired"}
                          </span>

                          {fact.is_active && (
                            <span
                              className={
                                "rounded px-2 py-0.5 text-xs font-semibold " +
                                (expired
                                  ? "bg-[#FDECEA] text-[#8A1C13]"
                                  : "bg-[#E6F0FA] text-[#164A82]")
                              }
                            >
                              {expired ? "Expired" : "Valid"}
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold">{fact.fact}</h3>

                        <p className="mt-2 text-sm text-[#566372]">
                          <strong className="text-[#172230]">Source:</strong>{" "}
                          {fact.source}
                        </p>

                        <p className="mt-1 text-sm text-[#566372]">
                          <strong className="text-[#172230]">Owner:</strong>{" "}
                          {fact.owner}
                        </p>

                        <p className="mt-1 text-sm text-[#566372]">
                          <strong className="text-[#172230]">Expires:</strong>{" "}
                          {fact.expires_on}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => startEdit(fact)}
                          className="rounded-md border border-[#D5DBE2] px-3 py-1.5 text-sm font-medium hover:bg-[#EEF1F4]"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => toggleActive(fact)}
                          className={
                            "rounded-md px-3 py-1.5 text-sm font-medium " +
                            (fact.is_active
                              ? "border border-[#B42318] text-[#8A1C13] hover:bg-[#FDECEA]"
                              : "border border-[#1F6B45] text-[#17553A] hover:bg-[#DDF0E5]")
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

        <p className="mt-5 text-xs text-[#566372]">
          Only administrator accounts can manage approved facts. Expiry labels
          are informational; the review API must also exclude expired facts.
        </p>
      </div>
    </main>
  );
}
