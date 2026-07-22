# Secwyn India Affiliate Operator Guide

## Safety boundary

- Use only the isolated `secwyn-affiliate-preview` Supabase project and the Vercel Preview scope for `codex/secwyn-india-affiliate-full`.
- Keep `AFFILIATE_KILL_SWITCH=true` and every Affiliate capability flag `false` until the preceding gate has evidence.
- Never copy Production users, payments, credentials, or customer data into Preview.
- Production migration, Production variables, provider changes, real commissions, payouts, and Telegram publishing require separate HumanOps approval.

## Preview database sequence

1. Apply `supabase/migrations/202607220001_india_affiliate_platform.sql` through the migration runner.
2. Confirm the migration history contains exactly the Affiliate migration and that all new public objects start with `affiliate_`.
3. Run schema, RLS, grant, immutable-trigger, uniqueness, replay, and two-worker claim probes from `DATABASE_RLS_EVIDENCE.md`.
4. Publish the immutable rule schedule through `affiliate_publish_rule_schedule` using the same UTC value as `AFFILIATE_PROGRAM_LAUNCH_START_AT`. Version 1 covers the first 12 months; version 2 starts immediately afterward.
5. Dry-run `node scripts/seed-affiliate-content.mjs`. Use `--apply` only with branch-scoped Preview Supabase variables and `AFFILIATE_CONTENT_SEED_TARGET=preview`; use `--apply-preview-db` only with the temporary isolated Preview database URL and remove that URL immediately after acceptance.
6. Verify 25 content records and seven Telegram message slots. The existing real channel remains paused and unverified; message 11 remains marked for replacement.

## Ordered Preview activation

Enable only one layer at a time and retain evidence before continuing:

1. `AFFILIATE_PUBLIC_PAGE`
2. `AFFILIATE_APPLICATIONS`
3. `AFFILIATE_PROVISIONAL_ACTIVATION`
4. `AFFILIATE_ATTRIBUTION`
5. `AFFILIATE_COMMISSION_SHADOW`
6. `AFFILIATE_COMMISSION_REAL`
7. `AFFILIATE_TEAM_REWARDS`
8. `AFFILIATE_PAYOUT_CREATION`
9. `AFFILIATE_PAYOUT_EXECUTION`
10. `AFFILIATE_TELEGRAM_DAILY`, then wins, then payout notices

Real commission, team rewards, payout, and Telegram remain forbidden during initial Preview acceptance. Shadow must have at least 30 representative events and zero unexplained reconciliation mismatch before any Real Commission request.

## Telegram rules

- Bot token and chat ID stay in the Preview secret store.
- The worker atomically claims rows with `FOR UPDATE SKIP LOCKED`; only the owning worker may complete them.
- Unknown delivery is never retried blindly. A daily publication remains unique for its channel and local date even after an unknown delivery result.
- Daily/rule content must be approved or published. A win requires a qualified sale plus privacy consent. A payout notice requires a paid and reconciled batch.
- The Bot never calculates commission and never reads raw payment or KYC data.

## Immediate rollback

Set `AFFILIATE_KILL_SWITCH=true`, then redeploy Preview. Keep every Affiliate flag false. Preserve provider facts, outbox, immutable decisions, and append-only ledger records. Correct financial history only with compensating reversal or adjustment entries.

## Monitoring

- Outbox age, attempts, locks, dead letters, and unknown delivery.
- Provider facts versus sales, decisions, schedules, ledger entries, and payout items.
- Primary versus independent audit calculator mismatches.
- Duplicate transaction, decision fingerprint, reversal, and Telegram publication attempts.
- Open High/Critical incidents, reconciliation state, payout freeze age, and kill-switch state.
