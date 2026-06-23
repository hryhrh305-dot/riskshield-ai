# Bug History

Use this file for confirmed defects and active investigations. Keep one entry per bug so future work can reuse evidence instead of repeating repository-wide analysis.

## Entry Template

```markdown
## YYYY-MM-DD - Short title

- Priority:
- Status: Investigating | Fixed | Monitoring
- Symptom:
- Root cause:
- Changed files:
- Fix:
- Impact:
- Verification:
- Prevention:
- Remaining risk:
```

Do not claim a root cause or fix before verification. Use `Under investigation` for unknown fields.

## 2026-06-23 - Sign In does not navigate

- Priority: P0
- Status: Fixed
- Symptom: After entering valid credentials and clicking Sign In, the page appears to remain on `/login`.
- Root cause: Supabase now persists the browser auth cookie as a `base64-...` encoded JSON payload. Our hand-written auth readers in `middleware` and core API routes only tried raw JSON parsing, then passed the undecoded `base64-...` string to Supabase user verification. Login itself succeeded, but the subsequent `/dashboard` request was redirected back to `/login` because the server could not recognize the session cookie.
- Changed files: `src/lib/auth-cookie.ts`, `src/middleware.ts`, `src/app/api/web-risk/route.ts`, `src/app/api/bulk-check/route.ts`, `src/app/api/settings/route.ts`, `tests/auth-cookie.test.mjs`.
- Fix: Added a shared auth-cookie helper that decodes `base64-...` payloads, supports legacy JSON cookies, and rejoins chunked auth cookies. Switched middleware and the core logged-in API routes to that shared parser.
- Impact: Users cannot reliably reach the authenticated dashboard.
- Verification: `node --test tests/auth-cookie.test.mjs` passes. `npm run build` passes. Browser automation against a local production server confirms the flow `POST /auth/v1/token -> GET /dashboard -> GET /api/settings` now returns `200` and the final URL stays on `/dashboard`.
- Prevention: Centralized cookie decoding in one helper and added regression coverage for base64 and chunked cookie formats.
- Remaining risk: Other old routes that still carry custom auth parsing and were not part of this P0 fix may need the same helper when we move on to the route-migration task.

## 2026-06-23 - Dashboard credits display mismatch

- Priority: P1
- Status: Fixed
- Symptom: The Risk Check page showed `49968` remaining credits for the same account, while the Dashboard showed `48745`, making the account look like it had consumed far more credits than it actually had.
- Root cause: Dashboard mixed two different sources. It treated `scan_history` counts as the remaining quota, while the authoritative credit balance lives in `profiles.credits_remaining`. On this account, `scan_history` had `1255` rows, but `profiles.total_checks` was `32` and `profiles.credits_remaining` was `49968`.
- Changed files: `src/app/(dashboard)/dashboard/page.tsx`.
- Fix: Switched the Dashboard credit card and quota status to read from `profiles.credits_remaining`, and changed the monthly usage card to read from `profiles.total_checks` instead of `scan_history` counts.
- Impact: The Dashboard now shows the same remaining credit balance as the Risk Check page, avoiding misleading quota alerts.
- Verification: Queried Supabase directly for the account row and confirmed `credits_remaining = 49968`, `total_checks = 32`. `npm run build` passes after the change.
- Prevention: Keep `profiles` as the single source of truth for credits and usage counters; use `scan_history` only for history and audit views.
- Remaining risk: Historical `scan_history` rows still exist and may continue to affect older analytics views until those views are migrated to profile-based counters.

## 2026-06-23 - Risk Check feels too slow

- Priority: P1
- Status: Fixed
- Symptom: Single-email Risk Check took too long, especially on first query for a domain.
- Root cause: The main `/api/web-risk` path repeated RDAP/DNS work it had already done, and `calculateRiskScore` previously ran several independent network checks in a mostly serial order. SMTP validation also had a relatively long timeout.
- Changed files: `src/lib/risk-engine.ts`, `src/app/api/web-risk/route.ts`.
- Fix: Parallelized independent blacklist and DNS lookups, overlapped SMTP validation with the DNS checks, cached domain-age lookups, lowered SMTP timeout to 3s, and removed duplicate RDAP/DNS lookups from the main web-risk route by deriving DNS health from the already returned email details.
- Impact: Risk Check should return faster while keeping the no-token, low-cost behavior for normal email/IP scoring.
- Verification: `npm run build` passes after the change.
- Prevention: Keep expensive validations behind the cheapest possible checks, reuse already fetched signals, and prefer in-memory caches before any new external request.
- Remaining risk: First-time checks for a brand-new domain can still wait on external RDAP/DNS/SMTP providers; if this remains slow in production, we should consider a deliberate “fast mode” that skips SMTP deep validation unless the user explicitly asks for it.
