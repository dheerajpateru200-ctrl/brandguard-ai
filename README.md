# BrandGuard AI

A pre-publication safety net that checks marketing text and poster images against approved brand rules and facts before content goes live.

**Automation detects. Evidence explains. Humans decide.**

- **Live demo:** [https://brandguard-ai-liard.vercel.app](https://brandguard-ai-liard.vercel.app)
- **Repository:** [https://github.com/dheerajpateru200-ctrl/brandguard-ai](https://github.com/dheerajpateru200-ctrl/brandguard-ai)

To try the demo, click **Create account**. New accounts start as Creators. Reviewer access is granted through the administrator workflow. Creators can submit content and view findings, while authorized reviewers can record decisions.

---

## The Problem

Employees, agencies and AI tools produce content faster than manual review can govern. BrandGuard AI adds a checking layer between creation and publication: it flags risky claims, explains each one with evidence, suggests a fix, and leaves the final decision to a person.

## What It Does

1. A creator pastes text, uploads a poster image, or submits both.
2. Rules check the text against banned terms, the approved-fact registry and fact expiry dates.
3. Gemini adds a second pass for tone and unsupported claims that exact rules cannot match.
4. Every finding provides the relevant text, explanation, cited evidence, severity, confidence, detection source and suggested fix.
5. Reviews enter a queue for authorized reviewers.
6. A reviewer approves, requests changes or escalates a submission with a comment.
7. Submissions and decisions are recorded in an audit trail.

---

## Features

### 1. AI-Powered Content Review

- Review typed marketing content.
- Use Gemini 2.5 Flash for additional semantic analysis.
- Detect potential tone and unsupported-claim issues.
- Distinguish rule-based findings from AI-generated findings.
- Provide explanations and suggested corrections.
- Retain rule-based findings when the AI service is unavailable.

### 2. Poster and Image Review

- Submit poster images alongside marketing text.
- Extract text from poster images using Gemini.
- Check extracted poster text against the same brand rules and approved facts.
- Present findings against the extracted text.

*Current visual-review limitation: the system checks poster text; it does not yet perform complete visual identity, logo, colour or layout analysis.*

### 3. Brand Knowledge Base

- Banned-term registry.
- Approved-fact registry.
- Fact ownership and expiry dates.
- Detection of expired or unsupported facts.
- Centralized management of brand compliance information.

### 4. Explainable Findings

Each finding can include:

- Highlighted text and numbered markers.
- Explanation of the issue.
- Supporting evidence.
- Severity and confidence.
- Detection source (rules or AI).
- Suggested correction.
- Apply-fix functionality for supported banned-term findings.

### 5. Review Workflow

- Creator content submission.
- Reviewer access management.
- Pending review queue.
- Approve, request changes and escalate decisions.
- Comments for decisions that require explanation.
- Review history and action timeline.
- Role-based access to review functionality.

### 6. Round 3: Improved Administration and User Experience

The Round 3 development extends the original prototype with improved administrative interfaces and management workflows.

**Admin Dashboard**

- Improved dashboard layout and navigation.
- Banned-term management interface.
- Add, edit, retire and reactivate banned terms.
- Search and filter functionality.
- Administrative overview and statistics.

**Reviewer Access Management**

- Dedicated reviewer access-request page.
- View and filter reviewer requests.
- Approve or reject access requests.
- Improved request status presentation.

**Approved Facts Management**

- Dedicated approved-facts administration page.
- Add and edit approved facts.
- Manage fact expiry information.
- Search and filter facts.
- Retire and reactivate facts.

**UI/UX Improvements**

- Consistent blue-purple gradient visual theme.
- Glass-style cards and dashboard elements.
- Improved navigation and page layouts.
- More consistent forms, status indicators and action controls.
- Improved presentation across administrative pages.

These interfaces are intended to make brand governance easier to manage without relying entirely on direct database editing.

---

## Technology Stack

| Layer                | Technology                                               |
| -------------------- | -------------------------------------------------------- |
| Frontend and backend | Next.js App Router, TypeScript, Tailwind CSS, API routes |
| Database             | Supabase PostgreSQL                                      |
| Authentication       | Supabase Auth                                            |
| Authorization        | Server-side role checks                                  |
| File storage         | Supabase Storage, private bucket and signed links        |
| AI                   | Google Gemini 2.5 Flash                                  |
| Hosting              | Vercel                                                   |
| Version control      | Git and GitHub                                           |

## System Architecture

```text
                  Users
                    |
                    v
             Next.js Application
              TypeScript / UI
                    |
          Authentication and Roles
                    |
                    v
             Content Submission
                    |
                    v
           Review Processing Layer
                    |
            +-------+-------+
            |               |
            v               v
        Rules Engine     Gemini AI
            |               |
            +-------+-------+
                    |
                    v
             Findings and Evidence
                    |
                    v
              Review Workflow
                    |
          +---------+---------+
          |                   |
          v                   v
      Reviewer             Admin
          |                   |
          v                   v
      Decisions       Brand Governance
          |           Banned Terms
          |           Approved Facts
          +---------+---------+
                    |
                    v
              Supabase Database
                    |
                    v
             Review History
              and Audit Log
```

## Project Structure

Important project areas include:

| Path                                   | Purpose                                      |
| -------------------------------------- | -------------------------------------------- |
| `app/page.tsx`                         | Main application and review experience       |
| `app/queue/page.tsx`                   | Reviewer queue                               |
| `app/history/page.tsx`                 | Review history and audit trail               |
| `app/admin/page.tsx`                   | Admin dashboard and banned-term management   |
| `app/admin/reviewer-requests/page.tsx` | Reviewer access-request management           |
| `app/admin/facts/page.tsx`             | Approved-facts management                    |
| `app/api/review`                       | Content review API                           |
| `app/api/review/decide`                | Review decision API                          |
| `app/api/queue`                        | Reviewer queue data                          |
| `app/api/reviews`                      | Review history data                          |
| `app/api/auth`                         | Authentication routes                        |
| `lib/rules.ts`                         | Rule-based analysis                          |
| `lib/gemini-findings.ts`               | AI text review                               |
| `lib/gemini-image.ts`                  | Poster image analysis                        |
| `lib/auth.ts`                          | Server-side authentication and authorization |

## Run Locally

### Prerequisites

- Node.js 20 or newer.
- npm.
- Supabase project.
- Google AI Studio API key.

### 1. Clone the repository

```bash
git clone https://github.com/dheerajpateru200-ctrl/brandguard-ai.git
cd brandguard-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env.local` in the project root:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_secret_key
GEMINI_API_KEY=your_gemini_api_key
```

Use the exact variable names referenced by the current application code.

**Never commit `.env.local` or expose server-side secrets.**

### 4. Configure Supabase

Create the database tables and storage bucket using the SQL setup below.

### 5. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Build for production

```bash
npm run build
```

---

## Database Setup

```sql

insert into storage.buckets (id, name, public)
values ('posters', 'posters',Run the original Round 2 database schema in the Supabase SQL Editor if you are creating a fresh database.
```

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
  role text not null default 'creator',
  created_at timestamptz not null default now()
);

alter table banned_terms enable row level security;
alter table approved_facts enable row level security;
alter table reviews enable row level security;
alter table audit_log enable row level security;
alter table profiles enable row level security;
 false)
on conflict (id) do nothing;
```

**Important:** This is the original baseline schema, not a complete migration for an existing Round 2 database. Apply the Round 3 schema changes and access-request tables required by the current application separately. Do not rerun this blindly against an existing production database.

## User Roles and Access

The application supports role-oriented access:

- **Creator:** Submits content and views review findings.
- **Reviewer:** Accesses the review queue and records review decisions.
- **Administrator:** Manages brand governance and reviewer access.

Reviewer access is granted through the administrative workflow. Role changes must be performed through the authorized application or database administration process.

## Testing

### Original Rules-Engine Baseline

The original rules-only baseline used 11 sample texts written by the author, containing 12 seeded violations.

| Measure                  | Result                                     |
| ------------------------ | ------------------------------------------ |
| Seeded violations caught | 11 of 12                                   |
| False positives          | 0 after whole-word matching was introduced |
| Missed                   | 1 reworded claim with no banned word       |

The original test set was written by the author with knowledge of the rules, so it may overstate performance. Independent testing with unseen content is a better measure.

### Round 3 Validation Areas

The updated application should be tested across:

- Content submission and AI review.
- Poster text extraction and checking.
- Banned-term creation, editing and retirement.
- Approved-fact creation, editing and expiry handling.
- Reviewer access requests and decisions.
- Creator, reviewer and administrator permissions.
- Review history and audit trail.
- Error handling and AI-service fallback.
- Production deployment and responsive UI.

Only tests actually executed should be reported as passed.

---

## Security and Privacy

- Supabase database access is protected through configured row-level security policies.
- Server-side routes perform authentication and authorization checks.
- Gemini API calls are made from the server.
- Poster files are stored in a private storage bucket and accessed using signed links.
- Administrative actions should be restricted to authorized administrators.
- User-submitted content and poster images are sent to Google's Gemini API for review.

Use only content that you are permitted to share with that service. The demo uses a synthetic brand kit and no confidential data.

## Current Limitations

- Rule-based checks primarily match known terms and numbers.
- AI-generated findings can be incorrect or unavailable.
- Poster review checks extracted text, not complete visual brand identity.
- No full logo, colour, contrast or layout verification yet.
- The audit trail is stored in a database and is not tamper-proof.
- The demo is designed around one synthetic brand knowledge base.
- Escalation does not yet automatically route a review to a named person.
- History records decisions but does not provide full content version control.
- Independent testing on unseen marketing content is still needed.

## Development Roadmap

Potential future enhancements include:

1. Advanced semantic verification against a larger brand knowledge base.
2. OCR and document support for PDF, PPTX and other content formats.
3. Visual contrast, colour, logo and layout analysis.
4. More advanced evidence retrieval and fact verification.
5. Slack and Microsoft Teams notifications.
6. External REST API integrations.
7. More comprehensive audit logging and monitoring.
8. Multi-organization support.
9. Automated end-to-end testing and performance improvements.

## Project Evolution

| Area             | Round 2                          | Round 3 development                                  |
| ---------------- | -------------------------------- | ---------------------------------------------------- |
| Content review   | Rules and Gemini AI              | Continued AI-assisted review                         |
| Poster analysis  | Gemini text extraction           | Continued poster text review                         |
| Brand governance | Database-managed rules and facts | Dedicated administrative interfaces                  |
| Banned terms     | Registry                         | Admin management interface                           |
| Approved facts   | Registry                         | Dedicated management interface                       |
| Reviewer access  | Administrator-controlled         | Reviewer request management interface                |
| User experience  | Initial prototype                | Consistent dashboard and glass-style UI improvements |

## Author

**Pateru Dheeraj Patel**
B.Tech, Computer Science and Engineering
National Institute of Technology Durgapur

**Development:** Individual / Solo Participant

Responsible for project planning, design, implementation, AI integration, database integration, testing and deployment.

---

**BrandGuard AI — Automation detects. Evidence explains. Humans decide.**
