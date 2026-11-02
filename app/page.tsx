"use client";

import { useEffect, useState } from "react";
import PosterPicker, { type Poster } from "./PosterPicker";

type Severity = "high" | "medium" | "low";
type Finding = {
  quote: string;
  issue: string;
  reason: string;
  source: string;
  severity: string;
  confidence: number;
  suggested_fix: string;
  origin: string;
};
type Review = {
  id: string;
  title: string;
  content: string;
  status: string;
  findings: Finding[];
  image_url?: string | null;
};
type Part = { text: string; sev?: Severity; idx?: number };
type SevStyle = {
  label: string;
  mark: string;
  bar: string;
  edge: string;
  chip: string;
};
type Session = { token: string; email: string; role: string };

const SEV: Record<Severity, SevStyle> = {
  high: {
    label: "High risk",
    mark: "bg-[#FADBD8] border-[#B42318]",
    bar: "bg-[#B42318]",
    edge: "border-l-[#B42318]",
    chip: "bg-[#FDECEA] text-[#8A1C13]",
  },
  medium: {
    label: "Medium risk",
    mark: "bg-[#F9E5BC] border-[#A15C07]",
    bar: "bg-[#A15C07]",
    edge: "border-l-[#A15C07]",
    chip: "bg-[#FCF1DC] text-[#7A4505]",
  },
  low: {
    label: "Low risk",
    mark: "bg-[#D5E6F7] border-[#1D5FA3]",
    bar: "bg-[#1D5FA3]",
    edge: "border-l-[#1D5FA3]",
    chip: "bg-[#E6F0FA] text-[#164A82]",
  },
};

const STATUS: Record<string, string> = {
  awaiting_approval: "Awaiting human approval",
  approved: "Approved",
  changes_requested: "Changes requested",
  escalated: "Escalated",
};

const STATUS_STYLE: Record<string, string> = {
  awaiting_approval: "bg-[#E4E9EE] text-[#2B3A49]",
  approved: "bg-[#DDF0E5] text-[#17553A]",
  changes_requested: "bg-[#FCF1DC] text-[#7A4505]",
  escalated: "bg-[#FDECEA] text-[#8A1C13]",
};

const SAMPLES = [
  {
    label: "Risky ad",
    title: "Summer launch advert",
    text: "Our serum is clinically proven to transform your skin overnight and cuts waste by 90%. It is dermatologist-tested.",
  },
  {
    label: "Reworded claim",
    title: "Social post",
    text: "Scientifically verified to erase wrinkles in a week.",
  },
  {
    label: "Clean ad",
    title: "Product page",
    text: "Glow serum contains 2% niacinamide and is vegan and cruelty-free.",
  },
];

const CHECKS = [
  "Banned terms and risky wording from your brand rules",
  "Numbers that no approved fact supports",
  "Claims that rely on facts which have expired",
  "Reworded claims the rules cannot match, checked by AI",
  "Text printed on poster images",
];

function sevOf(s: string): Severity {
  return s === "high" || s === "low" ? s : "medium";
}

function buildParts(content: string, findings: Finding[]) {
  const lower = content.toLowerCase();
  const ranges: {
    start: number;
    end: number;
    sev: Severity;
    idx: number;
  }[] = [];

  findings.forEach((f, idx) => {
    if (!f.quote) return;
    const i = lower.indexOf(f.quote.toLowerCase());
    if (i !== -1) {
      ranges.push({
        start: i,
        end: i + f.quote.length,
        sev: sevOf(f.severity),
        idx,
      });
    }
  });

  ranges.sort((a, b) => a.start - b.start);

  const parts: Part[] = [];
  const located = new Set<number>();
  let pos = 0;

  for (const r of ranges) {
    if (r.start < pos) continue;

    if (r.start > pos) {
      parts.push({ text: content.slice(pos, r.start) });
    }

    parts.push({
      text: content.slice(r.start, r.end),
      sev: r.sev,
      idx: r.idx,
    });

    located.add(r.idx);
    pos = r.end;
  }

  if (pos < content.length) {
    parts.push({ text: content.slice(pos) });
  }

  return { parts, located };
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [title, setTitle] = useState(SAMPLES[0].title);
  const [content, setContent] = useState(SAMPLES[0].text);
  const [review, setReview] = useState<Review | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stale, setStale] = useState(false);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [poster, setPoster] = useState<Poster | null>(null);

  useEffect(() => {
    let token = "";

    try {
      const raw = localStorage.getItem("bg_session");
      if (raw) token = JSON.parse(raw).token || "";
    } catch {
      token = "";
    }

    if (!token) {
      setReady(true);
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setSession({ token, email: d.email, role: d.role });
        } else {
          try {
            localStorage.removeItem("bg_session");
          } catch {}
        }
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  function clearWork() {
    setReview(null);
    setEditing(false);
    setStale(false);
    setActive(null);
    setError("");
    setNotice("");
    setComment("");
    setPoster(null);
  }

  async function submitAuth() {
    setAuthError("");
    setAuthBusy(true);

    try {
      const res = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/signup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authEmail,
            password: authPassword,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not sign in");
      }

      const s: Session = {
        token: data.access_token,
        email: data.email,
        role: data.role,
      };

      setSession(s);

      try {
        localStorage.setItem("bg_session", JSON.stringify(s));
      } catch {}

      setAuthPassword("");
      clearWork();
    } catch (e) {
      setAuthError(
        e instanceof Error ? e.message : "Could not sign in"
      );
    }

    setAuthBusy(false);
  }

  function logout(message?: string) {
    setSession(null);

    try {
      localStorage.removeItem("bg_session");
    } catch {}

    clearWork();
    setAuthError(message || "");
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (session ? session.token : ""),
    };
  }

  async function runReview() {
    if (!session) return;

    if (!content.trim() && !poster) {
      setError("Paste some content or add a poster first.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title,
          content,
          image: poster ? poster.data : undefined,
          actor: session.email,
        }),
      });

      if (res.status === 401) {
        logout("Your session expired. Log in again.");
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Review failed");
      }

      setReview(data);
      setPoster(null);

      if (data.content) {
        setContent(data.content);
      }

      setComment("");
      setStale(false);
      setEditing(false);
      setActive(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    }

    setLoading(false);
  }

  async function decide(decision: string) {
    if (!review || !session) return;

    setError("");

    const res = await fetch("/api/review/decide", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        id: review.id,
        decision,
        comment,
        actor: session.email,
      }),
    });

    if (res.status === 401) {
      logout("Your session expired. Log in again.");
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Could not save decision");
      return;
    }

    setReview({ ...review, status: data.status });
    setNotice("Decision saved: " + (STATUS[data.status] ?? data.status));
  }

  function selectFinding(i: number) {
    setActive(i);
    const el = document.getElementById("finding-" + i);

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function applyFix(f: Finding) {
    const i = content.toLowerCase().indexOf(f.quote.toLowerCase());

    if (i === -1) return;

    setContent(
      content.slice(0, i) +
        f.suggested_fix +
        content.slice(i + f.quote.length)
    );

    setEditing(true);
    setStale(true);
    setNotice("Fix applied to the text. Run the review again to check it.");
  }

  function startEdit() {
    setEditing(true);
    setStale(true);
  }

  function loadSample(s: (typeof SAMPLES)[number]) {
    setTitle(s.title);
    setContent(s.text);
    clearWork();
  }

  const role = session ? session.role : "creator";
  const findings = review ? review.findings ?? [] : [];
  const showProof = review !== null && !editing;

  const built = review
    ? buildParts(review.content, findings)
    : { parts: [], located: new Set<number>() };

  const decided = review
    ? review.status !== "awaiting_approval"
    : false;

  const count = (s: Severity) =>
    findings.filter((f) => sevOf(f.severity) === s).length;

  const aiCount = findings.filter((f) => f.origin === "ai").length;
  const ruleCount = findings.length - aiCount;

  const verdict =
    findings.length === 0
      ? "No issues found"
      : findings.length +
        (findings.length === 1 ? " issue" : " issues") +
        " to resolve before publishing";

  if (!ready) {
    return <div className="min-h-screen" />;
  }

  if (!session) {
    return (
      <div
        className="relative min-h-screen overflow-hidden bg-cover bg-center bg-fixed text-slate-900"
        style={{
          backgroundImage:
            "linear-gradient(rgba(5, 20, 55, 0.35), rgba(5, 20, 55, 0.35)), url('/brandguard-bg.png')",
        }}
      >
        <div className="pointer-events-none absolute -left-40 top-32 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-200/20 blur-3xl" />

        <header className="relative z-10 border-b border-white/70 bg-white/65 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/20">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                  <path d="M12 2.8 20 6v5.5c0 5.1-3.4 8.4-8 10.2-4.6-1.8-8-5.1-8-10.2V6l8-3.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="m8.5 12.1 2.3 2.3 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div>
                <div className="text-xl font-bold tracking-tight text-slate-900">
                  BrandGuard <span className="text-indigo-600">AI</span>
                </div>
                <div className="text-[11px] font-medium tracking-wide text-slate-500">
                  BRAND GOVERNANCE PLATFORM
                </div>
              </div>
            </div>

            <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Your brand. Always protected.
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto grid min-h-[calc(100vh-77px)] max-w-7xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:py-16">
          <section className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/75 px-4 py-2 text-xs font-semibold text-indigo-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              INTELLIGENT BRAND PROTECTION
            </div>

            <h1 className="font-doc text-5xl font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              Protect your brand in the age of{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
                AI.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              Create with confidence. BrandGuard AI checks your content against
              your brand guidelines, catches inconsistencies, and helps your
              team publish with confidence.
            </p>

            <div className="mt-9 grid max-w-xl gap-4 sm:grid-cols-3">
              {[
                {
                  icon: "✓",
                  title: "Brand consistency",
                  detail: "Keep every message on-brand",
                },
                {
                  icon: "⌕",
                  title: "AI-powered review",
                  detail: "Find issues before publishing",
                },
                {
                  icon: "◎",
                  title: "Human oversight",
                  detail: "People stay in control",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/80 bg-white/65 p-4 shadow-sm backdrop-blur"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600">
                    {item.icon}
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-9 flex items-center gap-3 text-sm text-slate-500">
              <div className="flex -space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f3f4ff] bg-indigo-100 text-xs font-bold text-indigo-700">
                  B
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f3f4ff] bg-sky-100 text-xs font-bold text-sky-700">
                  G
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f3f4ff] bg-violet-100 text-xs font-bold text-violet-700">
                  AI
                </div>
              </div>
              <span>Automation detects. Evidence explains. Humans decide.</span>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="rounded-[2rem] border border-white/90 bg-white/90 p-6 shadow-[0_25px_80px_-25px_rgba(67,75,150,0.25)] backdrop-blur-xl sm:p-9">
              <div className="mb-7">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                    <path d="M12 3 4.5 6v5.2c0 4.8 3.2 8 7.5 9.8 4.3-1.8 7.5-5 7.5-9.8V6L12 3Z" stroke="currentColor" strokeWidth="1.7" />
                    <path d="m8.5 12 2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <h2 className="font-doc text-3xl font-semibold tracking-tight text-slate-900">
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {mode === "login"
                    ? "Sign in to continue protecting your brand."
                    : "Get started with intelligent brand governance."}
                </p>
              </div>

              <div
                role="group"
                aria-label="Account action"
                className="mb-6 flex rounded-xl bg-slate-100 p-1"
              >
                {(["login", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => {
                      setMode(m);
                      setAuthError("");
                    }}
                    className={
                      "flex-1 rounded-lg px-3 py-3 text-sm font-semibold transition-all " +
                      (mode === m
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800")
                    }
                  >
                    {m === "login" ? "Log in" : "Sign up"}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAuth();
                }}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                  {mode === "signup" && (
                    <p className="mt-2 text-xs text-slate-500">
                      Use at least 8 characters.
                    </p>
                  )}
                </div>

                {authError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:from-indigo-700 hover:to-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authBusy
                    ? "Please wait..."
                    : mode === "login"
                      ? "Sign in to BrandGuard →"
                      : "Create your account →"}
                </button>
              </form>

              {mode === "signup" && (
                <p className="mt-5 rounded-xl bg-indigo-50/70 p-3 text-xs leading-5 text-indigo-800">
                  New accounts start as Creators. An administrator grants
                  Reviewer access.
                </p>
              )}

              <div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Secure access to your brand workspace
              </div>
            </div>
          </section>
        </main>

        <footer className="relative z-10 px-5 pb-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} BrandGuard AI. Brand governance, made
          smarter.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-baseline gap-3">
            <span className="font-doc text-2xl font-semibold tracking-tight text-slate-950">
              BrandGuard <span className="text-indigo-600">AI</span>
            </span>
            <span className="hidden text-sm text-slate-500 sm:inline">
              Brand governance for AI-era content
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            {role === "reviewer" && (
              <a
                href="/queue"
                className="rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                Review queue
              </a>
            )}

            {role === "creator" && (
              <a
                href="/reviewer-access"
                className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
              >
                Request Reviewer Access
              </a>
            )}

            {role === "admin" && (
              <a
                href="/admin"
                className="rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                Admin dashboard
              </a>
            )}

            <a
              href="/history"
              className="rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
            >
              Review history
            </a>

            <span className="hidden max-w-48 truncate text-slate-500 md:inline">
              {session.email}
            </span>

            <span
              className={
                "rounded-full px-3 py-1 text-xs font-semibold " +
                (role === "reviewer"
                  ? "bg-emerald-50 text-emerald-700"
                  : role === "admin"
                    ? "bg-violet-50 text-violet-700"
                    : "bg-slate-100 text-slate-700")
              }
            >
              {role === "admin"
                ? "Admin"
                : role === "reviewer"
                  ? "Reviewer"
                  : "Creator"}
            </span>

            <button
              onClick={() => logout()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 lg:py-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              AI-POWERED BRAND PROTECTION
            </div>

            <h1 className="font-doc text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Review your content
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500 md:text-base">
              Check every claim, catch brand inconsistencies and publish with
              confidence.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span className="font-semibold text-slate-900">BrandGuard AI</span>
            <span className="mx-2 text-slate-300">/</span>
            Creator workspace
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section
            aria-label="Content"
            className="self-start overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_-20px_rgba(15,23,42,0.22)]"
          >
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="title"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Content title
                </label>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                  CONTENT EDITOR
                </span>
              </div>

              <input
                id="title"
                className="font-doc w-full rounded-lg border border-transparent bg-transparent px-2 py-2 text-xl font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-200 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-medium text-slate-500">
                  Try a sample:
                </span>

                {SAMPLES.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => loadSample(s)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {review && review.image_url && showProof && (
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
                <img
                  src={review.image_url}
                  alt="Poster submitted for review"
                  className="max-h-72 rounded-xl border border-slate-200 shadow-sm"
                />
                <p className="mt-3 text-xs text-slate-500">
                  The text below includes the words read from the poster.
                </p>
              </div>
            )}

            {showProof ? (
              <div className="font-doc whitespace-pre-wrap px-6 py-7 text-lg leading-9 text-slate-800 md:text-xl">
                {built.parts.map((p, k) =>
                  p.sev ? (
                    <mark
                      key={k}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectFinding(p.idx as number)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          selectFinding(p.idx as number);
                        }
                      }}
                      className={
                        "cursor-pointer rounded-md border-b-2 px-1 text-slate-900 transition " +
                        SEV[p.sev].mark +
                        (active === p.idx
                          ? " ring-2 ring-indigo-500 ring-offset-2"
                          : "")
                      }
                    >
                      {p.text}
                      <sup className="ml-0.5 font-sans text-xs font-semibold">
                        {(p.idx as number) + 1}
                      </sup>
                    </mark>
                  ) : (
                    <span key={k}>{p.text}</span>
                  )
                )}
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 px-6 pt-5">
                  <label
                    htmlFor="content"
                    className="text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Marketing content
                  </label>
                  <p className="mt-1 text-xs text-slate-400">
                    Paste or write the content you want BrandGuard AI to check.
                  </p>
                </div>

                <label htmlFor="content" className="sr-only">
                  Content to review
                </label>

                <textarea
                  id="content"
                  className="font-doc block min-h-72 w-full resize-y bg-white px-6 py-6 text-lg leading-9 text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-indigo-50/20"
                  value={content}
                  placeholder="Paste your marketing text here..."
                  onChange={(e) => {
                    setContent(e.target.value);
                    if (review) setStale(true);
                  }}
                />
              </>
            )}

            {!showProof && (
              <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-5">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Add a poster or image
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    BrandGuard can also check text appearing inside your poster.
                  </p>
                </div>
                <PosterPicker value={poster} onChange={setPoster} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
              <button
                onClick={runReview}
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:from-indigo-700 hover:to-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Checking against brand rules..."
                  : review
                    ? "Run review again →"
                    : "Run review →"}
              </button>

              {showProof && (
                <button
                  onClick={startEdit}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  Edit text
                </button>
              )}

              <span className="ml-auto text-xs font-medium text-slate-400">
                {content.length} characters
              </span>
            </div>

            {showProof && (
              <p className="border-t border-slate-100 px-6 py-3 text-xs leading-5 text-slate-500">
                Numbered highlights match the findings on the right. Select
                either to see the other.
              </p>
            )}
          </section>

          <section aria-label="Findings" className="min-w-0">
            <div aria-live="polite">
              {error && (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </p>
              )}

              {notice && (
                <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  {notice}
                </p>
              )}
            </div>

            {!review && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.18)]">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 3 4.5 6v5.2c0 4.8 3.2 8 7.5 9.8 4.3-1.8 7.5-5 7.5-9.8V6L12 3Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <path
                        d="m8.5 12 2.2 2.2 4.8-4.8"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div>
                    <h2 className="font-doc text-2xl font-semibold text-slate-900">
                      What gets checked
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Five layers of content protection
                    </p>
                  </div>
                </div>

                <ul className="space-y-4">
                  {CHECKS.map((c, i) => (
                    <li key={c} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600">
                        ✓
                      </span>
                      <span className="text-sm leading-6 text-slate-600">
                        {c}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <p className="text-sm font-semibold text-indigo-900">
                    Evidence-backed decisions
                  </p>
                  <p className="mt-1 text-xs leading-5 text-indigo-700">
                    Every finding names its evidence. A reviewer makes the
                    final call.
                  </p>
                </div>
              </div>
            )}

            {review && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.18)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Review summary
                      </p>
                      <h2 className="font-doc mt-2 text-2xl font-semibold text-slate-900">
                        {verdict}
                      </h2>
                    </div>

                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      {findings.length} findings
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 text-sm">
                    {(["high", "medium", "low"] as Severity[]).map((s) => (
                      <span
                        key={s}
                        className={
                          "rounded-full px-3 py-1.5 text-xs font-semibold " +
                          SEV[s].chip
                        }
                      >
                        {count(s)} {s}
                      </span>
                    ))}
                  </div>

                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    {ruleCount} found by rules, {aiCount} found by AI.
                  </p>
                </div>

                {findings.length === 0 && (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                    Nothing in this text conflicts with your brand rules. A
                    reviewer can still approve or reject it below.
                  </p>
                )}

                {findings.map((f, i) => {
                  const sv = sevOf(f.severity);
                  const s = SEV[sv];
                  const conf = Math.max(
                    0,
                    Math.min(100, Math.round((f.confidence ?? 0.5) * 100))
                  );

                  return (
                    <article
                      key={i}
                      id={"finding-" + i}
                      onClick={() => setActive(i)}
                      className={
                        "rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-[0_8px_30px_-20px_rgba(15,23,42,0.25)] transition " +
                        s.edge +
                        (active === i
                          ? " ring-2 ring-indigo-500 ring-offset-2"
                          : " hover:border-slate-300")
                      }
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white " +
                            s.bar
                          }
                        >
                          {i + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold text-slate-900">
                              {f.issue}
                            </h3>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={
                                  "rounded-full px-2.5 py-1 font-semibold " +
                                  s.chip
                                }
                              >
                                {s.label}
                              </span>

                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-500">
                                {f.origin === "ai"
                                  ? "Found by AI"
                                  : "Found by rules"}
                              </span>
                            </div>
                          </div>

                          <p className="font-doc mt-3 rounded-lg bg-slate-50 p-3 text-lg leading-7 text-slate-800">
                            &ldquo;{f.quote}&rdquo;
                          </p>

                          {!built.located.has(i) && (
                            <p className="mt-2 text-xs text-amber-700">
                              Not matched word for word in the text.
                            </p>
                          )}

                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {f.reason}
                          </p>

                          <p className="mt-3 text-sm leading-6 text-slate-500">
                            <span className="font-semibold text-slate-800">
                              Evidence:
                            </span>{" "}
                            {f.source}
                          </p>

                          <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                            <span className="font-medium">
                              Confidence {conf}%
                            </span>

                            <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={"h-full rounded-full " + s.bar}
                                style={{ width: conf + "%" }}
                              />
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              Suggested fix
                            </p>

                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              {f.suggested_fix}
                            </p>

                            {f.issue === "Banned term" && !decided && (
                              <button
                                onClick={() => applyFix(f)}
                                className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                              >
                                Apply fix
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.18)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Human oversight
                      </p>
                      <h2 className="font-doc mt-1 text-xl font-semibold text-slate-900">
                        Reviewer decision
                      </h2>
                    </div>

                    <span
                      className={
                        "rounded-full px-3 py-1.5 text-xs font-semibold " +
                        (STATUS_STYLE[review.status] ??
                          "bg-[#E4E9EE] text-[#2B3A49]")
                      }
                    >
                      {STATUS[review.status] ?? review.status}
                    </span>
                  </div>

                  {stale && !decided && (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                      The text changed after this review. Run the review again
                      before deciding.
                    </p>
                  )}

                  {role !== "reviewer" && !decided && !stale && (
                    <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                      You are logged in as a Creator. Only a Reviewer can
                      approve, request changes or escalate.
                    </p>
                  )}

                  {role === "reviewer" && !decided && !stale && (
                    <div className="mt-4">
                      <label
                        htmlFor="comment"
                        className="text-sm font-semibold text-slate-700"
                      >
                        Comment
                      </label>

                      <input
                        id="comment"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                        placeholder="Required to request changes or escalate"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => decide("approved")}
                          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => decide("changes_requested")}
                          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                        >
                          Request changes
                        </button>

                        <button
                          onClick={() => decide("escalated")}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Escalate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}