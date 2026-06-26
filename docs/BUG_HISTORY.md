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

## Quick Reuse Index

Use this section when a similar symptom returns.

- Login click does nothing / dashboard never opens in a normal browser window: check session state, cookie decoding, and protected-route redirects.
- Dashboard credits or quota disagree across pages: trust `profiles.credits_remaining` as the source of truth.
- Risk Check feels slow: check `src/lib/risk-engine.ts` for serial network work and duplicated domain/DNS lookups.
- Google Sheets shows unclear running text: check the add-on script progress strings first.
- Password reset email opens a reset page, then bounces to login or an interstitial: check whether the template still uses `ConfirmationURL`, whether the link was pre-opened by the mail client, and whether `/reset-password` is preserving an active recovery token hash.

## 2026-06-25 - Password reset flow bounced between interstitial and login

- Priority: P0
- Status: Fixed
- Symptom: The password reset email opened a reset page briefly, then bounced to the login page or a handoff screen, and the password could not be changed. The forgot-password page also did not make the 60 second resend cooldown obvious enough.
- Root cause: The original reset flow relied on a raw `ConfirmationURL` in the email template, which was fragile in mobile mail clients and could be pre-opened or rewritten before the user tapped it. The custom handoff page also conflicted with active recovery state, and the resend throttle only lived in component state, so it was easy to miss or bypass during navigation.
- Changed files: `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/reset-password/page.tsx`, `src/app/auth/callback/route.ts`.
- Fix: Added a visible 60 second resend cooldown with localStorage persistence, switched the reset email flow to `token_hash` plus `type=recovery`, let `/reset-password` detect an active recovery session before showing any interstitial, and made the callback route keep recovery users on the reset flow instead of sending them to login.
- Impact: Password reset now survives mobile email clients much better and no longer depends on a fragile one-click `ConfirmationURL` path.
- Verification: `npm run build` passes after the change. Manual testing with a fresh reset email now reaches the real password reset flow instead of bouncing to login.
- Prevention: For Supabase recovery emails, prefer `token_hash` recovery links over raw `ConfirmationURL` query strings, and treat any reset-page handoff as secondary to an already active recovery session.
- Remaining risk: If the Supabase password reset template is reverted to the old `ConfirmationURL` format, the fragile behavior can come back.

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

## 2026-06-24 - Dashboard loads in incognito but not in normal window

- Priority: P0
- Status: Fixed
- Symptom: The dashboard could show a browser-style page load failure or appear stuck in a broken loading state in a normal browser window, while the same URL worked fine in an incognito window.
- Root cause: The normal browser session carried stale auth state or cached session data that no longer represented a valid Supabase session. The app initially trusted client-side session checks too much, so a bad browser state could still reach the dashboard shell and look like a page-load failure.
- Changed files: `src/middleware.ts`, `src/app/(dashboard)/dashboard/page.tsx`.
- Fix: Hardened the auth flow so protected routes redirect invalid sessions back to `/login`, and added a client-side dashboard fallback that redirects to sign-in when no valid profile/session is available.
- Impact: Normal browser sessions now recover cleanly instead of showing a misleading load failure, while valid logins still reach the dashboard normally.
- Verification: Confirmed that a stale session is redirected to `/login?reason=invalid_session&next=/dashboard`, and that a real login still reaches `/dashboard` and renders the dashboard cards.
- Prevention: When a bug only appears in a normal browser but not incognito, check stale cookies or session state first. For protected pages, keep a server-side redirect guard plus a lightweight client fallback so bad auth state cannot masquerade as a page-load failure.
- Remaining risk: If the browser profile contains other unrelated corrupt site data, the user may still need to clear site storage once; however, the dashboard should no longer appear to be broken just because the session is stale.

## 2026-06-24 - Payment success page stayed on syncing

- Priority: P1
- Status: Fixed
- Symptom: After a successful Creem payment, the success page stayed on a syncing message instead of resolving to a normal active-subscription state.
- Root cause: The page was waiting for subscription state changes without handling the case where webhook sync lagged or the account already had a higher-tier entitlement.
- Changed files: `src/app/(dashboard)/dashboard/billing/success/page.tsx`, `src/app/api/payment/webhook/route.ts`.
- Fix: Made the success page resolve to a clear state once payment was received, and ensured webhook-driven subscription activation could complete without leaving the user on an indefinite syncing message.
- Impact: Paid users now see a clear post-payment state instead of a page that looks stuck.
- Verification: Confirmed the success page no longer hangs after checkout and the subscription state is reflected after webhook processing.

## 2026-06-24 - Free plan could still use Bulk Scan

- Priority: P1
- Status: Fixed
- Symptom: Pricing said Bulk Scan starts on Starter, but the Free plan could still reach the bulk page and, from the route logic, still submit `/api/bulk-check`.
- Root cause: Bulk Scan only enforced login, not plan entitlement. The page explained the feature, but neither the page flow nor the API route blocked Free users.
- Changed files: `src/app/api/bulk-check/route.ts`, `src/app/(dashboard)/bulk-check/page.tsx`.
- Fix: Added a server-side Starter+ entitlement check in `/api/bulk-check` and returned a clear upgrade response for Free users. Added a matching page-level notice and upgrade CTA so the restriction is visible before and after submit.
- Impact: Bulk list screening entitlement now matches Pricing. Free users are guided back to single Risk Check or upgrade, while Starter and above keep working normally.
- Verification: `npm run build` passes. The deployed route now returns `403 BULK_PLAN_REQUIRED` for Free users, and the Bulk Scan page shows a Starter+ requirement notice with an Upgrade link.
- Prevention: Any feature promised as plan-gated on Pricing must be enforced in both places: server route first, UI second. Do not rely on page wording alone.
- Remaining risk: The API v1 batch route is intentionally separate and already plan-gated by API access, but future bulk-like tools should reuse the same entitlement pattern to avoid drift.

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

## 2026-06-23 - Scanner progress text is unclear

- Priority: P3
- Status: Fixed
- Symptom: Google Sheets showed a generic running state, and the web Risk Check / Bulk Check flows only showed minimal loading text.
- Root cause: The app relied on default execution feedback and terse button labels, which made the process feel unclear even though the scanners themselves were working correctly.
- Changed files: `google-sheets-addon/Code.gs`, `src/app/(dashboard)/risk-check/page.tsx`, `src/app/(dashboard)/bulk-check/page.tsx`.
- Fix: Added English progress toasts in Google Sheets and clearer English loading/status text in the web Risk Check and Bulk Check pages.
- Impact: Users now see a clearer scanning state without changing any detection logic.
- Verification: `npm run build` passes after the UI-only change.
- Prevention: Keep long-running flows paired with explicit progress text so the user always knows the action is in flight.
- Remaining risk: Google Sheets' built-in execution banner is controlled by Google and may still appear separately from our custom toast.

## 2026-06-24 - Dashboard loads in incognito but not in normal window

- Priority: P0
- Status: Fixed
- Symptom: The dashboard could show a browser-style page load failure or appear stuck in a broken loading state in a normal browser window, while the same URL worked fine in an incognito window.
- Root cause: The normal browser session carried stale auth state / cached session data that did not represent a valid Supabase session anymore. The app relied on client-side session checks only, so a bad or stale browser state could still reach the dashboard shell and create the impression that the page itself was failing.
- Changed files: `src/middleware.ts`, `src/app/(dashboard)/dashboard/page.tsx`.
- Fix: Hardened the auth flow so protected routes redirect invalid sessions back to `/login`, and added a client-side dashboard fallback that redirects to sign-in when no valid profile/session is available. This prevents stale browser state from leaving users on a half-loaded dashboard.
- Impact: Normal browser sessions now recover cleanly instead of showing a misleading load failure, while valid logins still reach the dashboard normally.
- Verification: Confirmed that incognito and normal browser sessions both work after re-login. Confirmed that a stale session is redirected to `/login?reason=invalid_session&next=/dashboard`, and that a real login still reaches `/dashboard` and renders the dashboard cards.
- Prevention: When a bug only appears in a normal browser but not incognito, check stale cookies/session state first. For protected pages, keep a server-side redirect guard plus a lightweight client fallback so bad auth state cannot masquerade as a page-load failure.
- Remaining risk: If the browser profile contains other unrelated corrupt site data, the user may still need to clear site storage once; however, the dashboard should no longer appear to be broken just because the session is stale.
