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
