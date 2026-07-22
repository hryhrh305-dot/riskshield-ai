# Secwyn India Affiliate — E0 read-only audit

Date: 2026-07-22
Start HEAD: `e78b0c3447733938eac3177ad02bee24f573b269`
Start branch: `main`
Remote: existing Secwyn GitHub origin (historical `riskshield` repository name)
Repository identity: `D:/ai-saas-mvp`, Secwyn, not Flowwyn.

## Working tree boundary

Two pre-existing untracked C2 documents were present before Affiliate work and remain outside Affiliate ownership:

- `docs/e8-8r/SECWYN_PHASE_C2_OPERATOR_GUIDE.md`
- `docs/e8-8r/SECWYN_PHASE_C2_TEST_CANARY_ACTIVATION_REPORT.md`

They must not be staged, changed or deleted by this work.

## Reusable verified architecture

- Next.js 16 App Router, React 19, TypeScript and Vitest.
- Supabase SSR Auth plus a server-only service client.
- Existing RLS migrations and append-style credit ledgers.
- Existing Creem signed webhook, payment, subscription, referral and idempotency work.
- Existing E8 outbox/observability patterns and admin allowlist.
- Existing Vercel deployment conventions and fail-closed server flags.

## Isolation decision

Affiliate is an additive modular monolith under `src/modules/affiliate`, with only `affiliate_` database objects. It does not reuse the existing customer Referral reward as an Affiliate commission ledger. It does not edit Credits, plans, pricing, risk decisions, reports, Auth critical fields or Creem transaction processing. Payment facts enter through an asynchronous adapter/outbox only; Affiliate failure cannot roll back customer billing.

## Risks and controls

| Risk | Control |
|---|---|
| Duplicate commission | Provider event uniqueness, business fingerprint and database idempotency key |
| Wrong amount from browser | No public amount/Product/Affiliate input; server-side rule snapshot and bigint minor units |
| Rule drift | Immutable published rule versions and checksums |
| Ledger rewrite | Append-only triggers; compensating reversal/clawback entries |
| A earns from C | Attribution generation check equals one; pure-domain rejection |
| Test/live contamination | Affiliate features default off; shadow decision status; no payout adapter enabled |
| Telegram privacy or false wins | Consent, qualification, paid+reconciled checks, idempotency, retry/DLQ and pause |
| Payout fraud | $50 minimum, 72-hour freeze, reconciliation, verified account, re-auth/PIN/OTP and kill switch |
| Existing Secwyn regression | No edits to pricing, Credits, risk engine, reports or current Creem routes |

## HumanOps-only gates

Production migration, Production flags, secrets, Telegram bot/channel administration, real Creem/Payoneer operations, real announcements and payout remain prohibited until separately authorized.
