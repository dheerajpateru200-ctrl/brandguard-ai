# BrandGuard AI

A pre-publication safety net that checks marketing content against approved brand rules and facts. Automation detects, evidence explains, humans decide.

- Live demo: https://brandguard-ai-liard.vercel.app
- Repository: https://github.com/dheerajpateru200-ctrl/brandguard-ai

## What it does

1. A creator pastes content and runs a review.
2. The rules engine checks it against banned terms, the approved-fact registry and expiry dates.
3. Each finding shows the exact text, the reason, the cited source, severity, confidence and a suggested fix.
4. A reviewer approves, requests changes or escalates, with a comment.
5. Every action is saved to an audit trail, visible on the History page.

## Tech stack

- Next.js (App Router), TypeScript, Tailwind CSS
- Next.js API routes as the backend
- Supabase (PostgreSQL) with Row Level Security enabled
- Deployed on Vercel

## Run locally

1. `npm install`
2. Create `.env.local` with:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
3. Create the tables and seed data in the Supabase SQL editor.
4. `npm run dev`, then open http://localhost:3000

## Limitations

- Rules only match known terms and numbers, so reworded claims are missed.
- Login is a role switcher (Creator / Reviewer), not real authentication.
- Text input only.
- The brand kit is synthetic (a fictional skincare brand).