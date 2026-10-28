# BrandGuard AI

A pre-publication safety net that checks marketing text and poster images against approved brand rules and facts before content goes live.

**Automation detects. Evidence explains. Humans decide.**

- Live demo: https://brandguard-ai-liard.vercel.app
- Repository: https://github.com/dheerajpateru200-ctrl/brandguard-ai

To try the demo, click "Create account" (any email, 8+ characters). New accounts start as Creators. Reviewer access is granted by an administrator, so a Creator can submit content and see findings but cannot record decisions.

## The problem

Employees, agencies and AI tools produce content faster than manual review can govern. BrandGuard AI adds a checking layer between creation and publication: it flags risky claims, explains each one with evidence, suggests a fix, and leaves the final decision to a person.

## What it does

1. A creator pastes text, uploads a poster image, or both.
2. Rules check the text against banned terms, the approved-fact registry and fact expiry dates.
3. Gemini adds a second pass for tone and unsupported claims that exact rules cannot match.
4. Every finding shows the exact text, the reason, the cited evidence, severity, confidence, whether it came from rules or AI, and a suggested fix.
5. Reviews wait in a queue, oldest first. A reviewer approves, requests changes or escalates, with a comment.
6. Every submission and decision is saved to an audit trail that shows the real account.

## Features built

- Brand knowledge base: banned-term list and approved-fact registry with owner and expiry date (stored in the database)
- Rules engine: banned terms (whole-word matching), numbers that no approved fact supports, claims that rely on expired facts
- AI review (Gemini 2.5 Flash): tone and unsupported-claim findings, labelled "Found by AI"
- Poster support: the words on a poster image are read by Gemini and checked like typed text
- Explainable findings: highlighted text with numbered markers, reason, cited source, severity, confidence bar, suggested fix, and an "Apply fix" button for banned terms
- Accounts and roles: email and password sign-up, Creator and Reviewer roles, roles checked on the server
- Review queue: pending reviews listed oldest first, with wait times, visible to reviewers only
- Decisions: approve, request changes or escalate, with a comment (required for the last two); a decided review cannot be decided again
- History: reviewers see all reviews, creators see their own, each with an action timeline
- Safe fallbacks: if the AI call fails, the rules findings are still returned

## Technology

| Layer | Technology |
|---|---|
| Frontend and backend | Next.js (App Router), TypeScript, Tailwind CSS, API routes |
| Database | Supabase PostgreSQL with row-level security on every table |
| Authentication | Supabase Auth (email and password), roles in a profiles table |
| File storage | Supabase Storage, private bucket, short-lived signed links |
| AI | Google Gemini 2.5 Flash, called from the server only |
| Hosting | Vercel |

## Project layout

- `app/page.tsx`: login, review screen, findings and decisions
- `app/queue/page.tsx`: review queue for reviewers
- `app/history/page.tsx`: review history and audit trail
- `app/api/review`: submit and review content
- `app/api/review/decide`: record a decision (reviewers only)
- `app/api/queue` and `app/api/reviews`: queue and history data
- `app/api/auth`: sign-up, login and current-user routes
- `lib/rules.ts`: rules engine
- `lib/gemini-findings.ts` and `lib/gemini-image.ts`: AI text review and poster reading
- `lib/auth.ts`: server-side login and role check

## Run it locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Create a Supabase project and a Google AI Studio API key.
4. Create a file named `.env.local` in the project root with:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_secret_key
GEMINI_API_KEY=your_gemini_api_key
```

5. Create the database (see the next section).
6. Run `npm run dev` and open http://localhost:3000.

Never commit `.env.local`. The secret key is used on the server only.

## Database setup

Run this in the Supabase SQL editor:

```sql
create table banned_terms (
  id serial primary key,
  term text not null,
  reason text not null,
  suggestion text,
  severity text not null default 'medium'
);

create table approved_facts (
  id serial primary key,
  fact text not null,
  source text not null,
  owner text not null,
  expires_on date not null
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  status text not null default 'awaiting_approval',
  findings jsonb not null default '[]',
  ai_provider text,
  decision_comment text,
  decided_by text,
  created_by text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  image_path text,
  image_text text
);

create table audit_log (
  id serial primary key,
  review_id uuid references reviews(id) on delete cascade,
  action text not null,
  actor text not null,
  comment text,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'creator' check (role in ('creator', 'reviewer')),
  created_at timestamptz not null default now()
);

alter table banned_terms enable row level security;
alter table approved_facts enable row level security;
alter table reviews enable row level security;
alter table audit_log enable row level security;
alter table profiles enable row level security;

insert into storage.buckets (id, name, public)
values ('posters', 'posters', false)
on conflict (id) do nothing;
```

Then add a few rows to `banned_terms` and `approved_facts`. The demo uses a fictional skincare brand, for example banned terms such as "clinically proven", "miracle" and "guaranteed", and approved facts such as "Glow serum contains 2% niacinamide" with an owner and an expiry date.

## Giving someone Reviewer access

New accounts are Creators. An administrator promotes an account in the Supabase SQL editor:

```sql
update profiles set role = 'reviewer' where email = 'person@example.com';
```

## Testing

Rules-only baseline on a set of 11 sample texts written by the author, containing 12 seeded violations:

| Measure | Result |
|---|---|
| Seeded violations caught | 11 of 12 |
| False positives | 0 (one was found in testing, where "cure" matched inside "secure", and fixed with whole-word matching) |
| Missed | 1, a reworded claim with no banned word, which is the case the AI layer targets |

The author wrote this test set knowing how the rules work, so it is likely to flatter the engine. Independent testing with other people's text is the better measure.

## Security and privacy

- Database tables use row-level security, and the secret key exists only on the server.
- Every route that changes data checks the login token on the server, and decisions are accepted from Reviewers only.
- Posters are stored in a private bucket and shown through short-lived signed links.
- Typed text and poster images are sent to Google's Gemini API for review. Use only content you are allowed to share with that service. The demo uses a synthetic brand kit and no confidential data.
- Accounts store an email address and a role.

## Limitations

- The rules match known terms and numbers only. Reworded claims depend on the AI, which can be wrong or unavailable on the free tier.
- Posters are checked for their words only. There are no contrast, colour, logo or layout checks, and highlights are shown on the extracted text, not on the image.
- Brand rules and approved facts are edited in the database, not through a screen.
- Sign-up is open and not email-verified. Reviewer access is granted by an administrator.
- A reviewer can currently decide on content they submitted themselves.
- Escalation records the decision and reason but does not notify or route to a named person.
- History shows decisions, not versions of the content. Re-running a review creates a new review.
- The audit trail is a database table and is not tamper-proof.
- One organisation only. The demo knowledge base is a small synthetic skincare kit.

## Changes from the original plan

| Planned in Round 1 | Built in Round 2 | Reason |
|---|---|---|
| FastAPI backend | Next.js API routes | One deployment for a short build window |
| PostgreSQL with pgvector retrieval | Supabase PostgreSQL, facts read directly | The knowledge base is small, so vector search is not needed yet |
| Redis and Celery queue | A review queue ordered by arrival time in the database | No long background jobs at this scale |
| S3 storage | Supabase Storage with signed links | Same protection, one fewer service |
| Claude API | Gemini 2.5 Flash behind its own module | API cost for a solo student |
| OIDC single sign-on | Email and password accounts with server-checked roles | Time |
| Document, PDF and PPTX parsing, OCR, OpenCV | Typed text and poster images | Moved to Round 3 |
| Slack, CMS and API integrations | Not built | Moved to Round 3 |

## Round 3 plan

1. Accessibility and visual checks on posters: contrast, alt text, readability, and logo and colour consistency.
2. Admin screens and an insights dashboard: manage rules, facts and roles without SQL, and report repeat violations, expired facts and time to decision.
3. Integrations and hardening: Slack or Teams notifications, a REST API for other writing tools, rate limiting, and blocking self-approval.

## Author

Pateru Dheeraj Patel, B.Tech 3rd year, National Institute of Technology Durgapur. Solo participant, responsible for research, design, build and presentation.