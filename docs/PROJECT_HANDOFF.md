# RiskShield AI - Project Handoff Document

Generated: 2026-06-22
Project: AI-powered Customer Risk Intelligence Platform
Repo: hryhrh305-dot/riskshield-ai (branch: main)
Live: https://www.574269.xyz
Vercel: riskshield-api

---

## 1. Project Overview

RiskShield AI is an AI-powered Customer Risk Intelligence Platform. It helps B2B teams avoid bounced emails, fraud, and wasted outreach spend by scoring email addresses and domains for risk.

Target users: SaaS companies, email marketing teams, sales teams, recruitment platforms, fintech, B2B enterprises.

Core value: Input someone@company.com, output Customer Health Score + Risk Level + Recommendation.

---

## 2. Tech Stack

- Frontend: Next.js 16.2.9 (Turbopack), React, Tailwind CSS, Lucide icons
- Backend: Next.js API Routes (App Router)
- Database: Supabase PostgreSQL (njhjiavnidssjvnkcxfo.supabase.co)
- Auth: Supabase Auth + Supabase SSR cookies
- Payment: Creem (checkout + webhook)
- AI: DeepSeek API (explanations only, NOT scoring)
- DNS: Node.js dns/promises (MX, SPF, DMARC)
- IP Geo: ip-api.com (free, 45 req/min)
- Deployment: Vercel (riskshield-api)
- Domain: 574269.xyz (DNS via Vercel)
- Google Add-on: Google Apps Script (private)

## 3. Key Files

- src/lib/risk-engine.ts: CORE scoring engine, DNS checks, SMTP
- src/lib/disposable-domains.ts: 7565+ disposable domains
- src/lib/blacklist.ts: Blacklist operations
- src/lib/cost-control.ts: Credits/cost per plan
- src/lib/plans.ts: Subscription plan definitions
- src/app/api/v1/email/batch-check/route.ts: GS batch API (API key auth)
- src/app/api/bulk-check/route.ts: Web batch + XLSX (session auth)
- src/app/api/web-risk/route.ts: Single email/IP check
- src/app/(dashboard)/bulk-check/page.tsx: Bulk upload page
- src/app/(dashboard)/risk-check/page.tsx: Single check page
- src/app/(dashboard)/dashboard/page.tsx: Dashboard
- google-sheets-addon/Code.gs: Google Apps Script add-on
- supabase-schema.sql: Database schema

---

## 4. Completed Features

- Email risk detection (disposable, role-based, MX, SPF, DKIM, DMARC, SMTP, blacklist, domain age, IP geo, catch-all)
- IP risk detection (geolocation, proxy/VPN/Tor/hosting, blacklist)
- Batch upload (CSV/XLSX upload, paste emails, auto-detect email column)
- Download: XLSX, All CSV, Clean CSV, Risky CSV (with summary)
- Google Sheets add-on (Scan Selected Emails, Settings, writes results to sheet)
- Dashboard (credits, usage stats)
- Pricing/plans (Free/Starter/Growth/Pro) via Creem
- API v1 (5 endpoints with API key auth)

---

## 5. Scoring Model

### Decision Boundaries
- ALLOW: 0-25
- REVIEW: 26-65
- BLOCK: 66-100

### Rules
- Disposable domain: +45
- Role-based prefix (info/sales/support/admin/etc): +20
- Generic prefix (test/demo/user/guest/temp): +25
- Spam keywords in local part: +30
- Suspicious TLD: +15
- Personal email pattern (first.last): -10 (only if NOT disposable/role-based)
- No MX records: +40
- Missing SPF: +15
- Missing DMARC: +10
- Domain keywords (scam/phish/fraud/spam/fake): +30
- Blacklist hit: +35
- Domain age less than 90 days: +20
- Domain age less than 365 days: +10
- Valid MX exists: -10
- SPF exists: -5
- DMARC exists: -5
- Mailbox full: +15
- SMTP temp rejection: +10
- SMTP perm rejection: +30
- Catch-all domain: +10

Score clamped to 0-100.

DNS cache TTL: 7 days (in-memory Map).

---

## 6. Known Bugs

- Vercel timeout on large batches (need async worker)
- GS vs Web slight score variance (different DNS cache per serverless instance)
- XLSX download: fixed via static xlsx import (985df12), needs verification
- Clean CSV: fixed decision-to-risk_level field name (985df12), needs verification

---

## 7. Supabase

URL: https://njhjiavnidssjvnkcxfo.supabase.co
Publishable: sb_publishable_6pS7tKkxxBqYTLcAUu_GPg_0BysHHx8
Service role: sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ
Test user: hryhrh123@163.com / RiskShield2026!
GS API Key: fsk_bjcvaznruzxrpy5nc461kgxhqh5lcw9j

Tables: profiles, api_keys, usage_ledger, scan_history, api_usage, blacklist, subscriptions

---

## 8. Current Status

Just completed (985df12): XLSX static xlsx import + Clean CSV field fix.
Needs verification: deploy and test both on www.574269.xyz.

Next: async worker for batch, company intelligence, GS Marketplace publish.

---

## 9. Do NOT Break

- Scoring rules and decision boundaries
- All API endpoints
- Google Sheets compatibility
- Supabase schema (no drops)
- DNS caching (7-day TTL)
- Disposable domain list (7565+)
- Server-side credit consumption
- Supabase SSR auth flow

---

## 10. New Thread Startup

Copy this prompt into a new Codex thread:

You are taking over an existing SaaS project: RiskShield AI.

First: read docs/PROJECT_HANDOFF.md completely.
Second: scan the project structure at D:/ai-saas-mvp.

Output: your understanding of the current state, architecture, completed features, risks, and recommended next priority.

Do NOT modify any code yet. Do NOT redesign architecture. Keep all existing functionality. Wait for my instructions.

---

End of Handoff
