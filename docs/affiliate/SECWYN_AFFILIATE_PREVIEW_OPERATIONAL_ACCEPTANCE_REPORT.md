# Secwyn Affiliate Preview Operational Acceptance

Date: 2026-07-22

## 1. Verdict

`PASS WITH HUMANOPS GATES`.

The isolated Affiliate Preview passed the implemented operational, browser, database, security, idempotency and regression gates. No known Affiliate-specific Critical or High issue remains. This is not a claim of absolute security or zero possible vulnerabilities. Private Telegram target verification and every Production launch action remain HumanOps-controlled.

## 2. Git and Scope

- Git root: `D:/ai-saas-mvp`
- Branch: `codex/secwyn-india-affiliate-full`
- Task-requested baseline: `feed1e530e18e97cee06ce9518b6f8d0a67f7360`
- Reviewed operational commits before this report: `047a962`, `6a73a68`, `f717311`
- Final HEAD: recorded after the final operational acceptance commit
- Main modified: No
- Production modified: No
- Two pre-existing untracked C2 documents remained untouched and uncommitted.

## 3. Preview Flag Matrix

| Capability | Before | Operational acceptance |
|---|---:|---:|
| Kill Switch | `true` | `false` in isolated Preview only |
| Public Page | `false` | `true` |
| Applications | `false` | `true` |
| Provisional Activation | `false` | `true` |
| Attribution | `false` | `true` |
| Commission Shadow | `false` | `true` |
| Content Admin | `false` | `true` |
| Admin | `false` | `true` |
| Real Commission | `false` | `false` |
| Team Rewards | `false` | `false` |
| Payout Creation | `false` | `false` |
| Payout Execution | `false` | `false` |
| Telegram Daily/Wins/Payout Notice | `false` | `false` |

All 23 required variable names are branch-scoped to Preview. Values are intentionally omitted. Production variables were not changed.

## 4. Browser E2E

- Public India page: 200, desktop/mobile, no horizontal overflow.
- Unauthenticated application: redirected to login.
- Applicant: submitted the real form with five correct policy answers; portal showed application received and 5/5 passed.
- Idempotency: one application and one quiz attempt remained after retries.
- Provisional: two of three valid actions, two of two formats, correct activation/grace messaging.
- Approved A: Founding Affiliate state, direct relationship only, payout shown as not configured.
- Admin: application review, controls and danger gates visible with no hydration or console errors.
- Content operator and compliance reviewer: content access allowed, admin control center denied.

## 5. Application and Relationship Integrity

- Synthetic users: 8, all `.invalid`, isolated Preview only.
- Applications: 5.
- Memberships: 4.
- A-B: 1.
- B-C: 1.
- A-C: 0.
- A earnings from C: 0.
- Real customer data: 0.

## 6. Content Operations

A synthetic content item completed create, impact resolution, approval, publication and export through the authenticated Preview routes. Content stayed versioned and database-backed; no React hard-coding was introduced.

## 7. Telegram Private Canary

- A distinct synthetic private-canary channel and one pending publication were prepared.
- The route verified the target before sending and failed closed with HTTP 503 `target_unverified`.
- Telegram attempt count: 0.
- Private messages sent: 0.
- Real messages sent: 0.
- Unknown delivery: No.
- Message ID: None, because delivery did not start.
- The real channel remained paused/unverified and was never called.

This is the single operational HumanOps gate: confirm bot access to the exact private test channel before one controlled retry. Do not change the real channel.

## 8. Commission, Worker and Kill Switch

- Real Commission: 0.
- Real Payout: 0.
- Ledger rows: 0.
- Payout batches/items: 0/0.
- Shadow mismatch: 0.
- Duplicate commission: 0.
- Payment/refund/chargeback replay and 100-worker claim tests remain passed from the fresh-database suite.
- The Kill Switch was released only after every dangerous flag was confirmed false in the isolated Preview.

## 9. Database and Security

- Additive Preview migration hardened five trigger-function search paths.
- Affiliate security advisor: Critical 0, Error 0, Warning 0.
- Own-row/cross-owner/anonymous RLS checks passed.
- The only remaining project security warning is Supabase Auth leaked-password protection, a separate HumanOps setting.
- No Production migration was run.

## 10. Validation

- Vitest: 50 files, 461/461 passed.
- Build: 72/72 routes generated.
- Targeted ESLint: passed.
- `git diff --check`: passed before commit.
- TypeScript: 120 inherited repository errors; Affiliate-related changed-file delta 0.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities using the approved proxy.
- Secret scan: 0 tracked secret literals. A test regex for recognizing secret prefixes is not a secret value.
- Vercel error logs: none.
- Vercel 5xx logs: one intentional Telegram canary 503, fail closed before delivery.

## 11. Preview Deployment

- Stable branch URL: `https://riskshield-api-git-codex-secwyn-india-affil-9d0799-hrh-projects.vercel.app`
- Accepted runtime deployment: `https://riskshield-q7zp5ozyz-hrh-projects.vercel.app`
- Status: `Ready`

## 12. Production Untouched Evidence

- Production homepage: 200.
- Production Affiliate public route: 404.
- Production Affiliate API route: 404.
- Production migration: 0.
- Production secrets changes: 0.
- Production flags changes: 0.
- Production deployments from this task: 0.
- Real Commission: 0.
- Real Payout: 0.
- Real Telegram sends: 0.

## 13. Remaining HumanOps

1. Correct/confirm private Telegram bot access and exact private test target, then authorize one retry.
2. Decide whether to enable Supabase Auth leaked-password protection in the isolated Preview project.
3. Keep Production migration, Production secrets, Production flags, Production deployment, real commission, payout and real Telegram behind separate approvals.
4. Keep real-channel message 7 as `Update Required` until the future Production Application Page is approved.
5. Complete a representative Shadow observation period before any Production launch decision.

## 14. Final State

```text
Production Changes: 0
Production Migration: 0
Production Secrets Changes: 0
Production Flags Changes: 0
Production Deployments: 0
Real Commission: 0
Real Payout: 0
Real Telegram Sends: 0
Private Telegram Sends: 0
Shadow mismatch: 0
Duplicate Commission: 0
A from C: 0
Final HEAD: recorded after commit
Preview URL: https://riskshield-api-git-codex-secwyn-india-affil-9d0799-hrh-projects.vercel.app
Test Count: 461/461
Production Launch: HUMANOPS_REQUIRED / TBD
```
