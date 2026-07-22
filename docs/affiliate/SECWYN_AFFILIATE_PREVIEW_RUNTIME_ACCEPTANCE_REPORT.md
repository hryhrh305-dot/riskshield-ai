# Secwyn Affiliate Preview runtime acceptance

Date: 2026-07-22

## Isolation

- Vercel project: `riskshield-api`.
- Target: Preview only, branch `codex/secwyn-india-affiliate-full`.
- Database: independent, empty-customer Supabase Preview project; reference intentionally omitted.
- Production database was never connected, queried, migrated or reset.
- Vercel reported 23 Sensitive variables, all scoped to Preview and the Affiliate branch.
- Production variables and Production deployment were not modified.

## Fresh Database

- The initial partial history contained only the first three historical migrations.
- Root cause: core tables had historically lived in repository SQL Editor scripts rather than ordered migrations.
- A repository-backed core baseline migration was added before historical migrations.
- A guarded `db reset --db-url --no-seed` replayed all 17 migrations from empty state.
- A second push was up to date and `db lint --level error` passed.

## Runtime results

| Gate | Result |
|---|---|
| Affiliate tables | PASS — 60 |
| Affiliate functions | PASS — 20 |
| RLS | PASS — 60/60 enabled |
| SECURITY DEFINER ACL | PASS — 12/12 service-role only |
| Owner/cross-owner/anon matrix | PASS |
| Immutable mutation probes | PASS — 6/6 rejected |
| Shadow database scenarios | PASS — 36 |
| Primary/Audit mismatch | PASS — 0 |
| Payment replay | PASS — 100 calls, one business outcome |
| Refund replay | PASS — 100 calls, one Clawback |
| Chargeback replay | PASS — 100 calls, one Clawback |
| Outbox worker claims | PASS — 100/100 unique |
| Telegram queue claims | PASS — 100/100 unique |
| Daily publication | PASS — one channel/date row |
| Content publish concurrency | PASS — one publication |
| Rule publish concurrency | PASS — one schedule, idempotent replay |
| Content seed | PASS — 24 records / 7 slots, two-run idempotency |
| Production changes | 0 |

## Remaining external gate

Bot and private test-channel variables exist as Vercel Sensitive values, but their plaintext values are correctly unavailable through the connected Vercel tooling. No real-channel message was sent. Private-channel external delivery remains HumanOps; all mock, policy, database queue and concurrency checks passed.

## Operational Browser Acceptance

- Stable branch URL: `https://riskshield-api-git-codex-secwyn-india-affil-9d0799-hrh-projects.vercel.app`.
- Latest accepted runtime deployment before final documentation: `https://riskshield-q7zp5ozyz-hrh-projects.vercel.app` (`Ready`).
- Public India page returned 200 on desktop and mobile with no horizontal overflow.
- Unauthenticated application access redirected to login.
- Synthetic applicant submission passed all five policy questions and remained idempotent at one application and one quiz attempt.
- Provisional portal showed two of three valid actions, both required formats and the correct grace/early-activation contract.
- Approved A saw the Founding Affiliate state and direct A-B relationship only; A could not see or earn from C through B.
- Super-admin could review applications and manage content. Content operators and compliance reviewers could access the content library but were denied the admin control center.
- A full content lifecycle was executed against synthetic Preview content: create, impact resolution, approve, publish and export.
- Production remained unchanged: the Production homepage returned 200 while Affiliate public and API routes remained unavailable.

## Runtime Logs and Security

- No error-level logs were recorded during the acceptance window.
- The only 5xx log was the intentional private Telegram canary POST, which returned 503 before delivery because the configured target could not be verified.
- Supabase security advisor: Affiliate Critical 0, Error 0 and Warning 0 after applying additive trigger `search_path` hardening. The remaining project warning is the Auth leaked-password-protection setting and requires a separate HumanOps decision.
- RLS runtime confirmed own-row visibility, cross-owner isolation and fail-closed anonymous access.
- The 23 required variable names are scoped to the Affiliate Preview branch; runtime checks proved the isolated Supabase and safe flags were loaded. No value is recorded here.
