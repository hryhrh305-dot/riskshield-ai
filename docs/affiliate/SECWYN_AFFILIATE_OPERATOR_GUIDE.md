# Secwyn India Affiliate Operator Guide

## Safe rollout sequence

1. Review and apply `202607220001_india_affiliate_platform.sql` to an isolated Preview database.
2. Run the content seeder in dry-run mode. Use `--apply` only with `AFFILIATE_CONTENT_SEED_TARGET=preview`.
3. Keep every Affiliate flag false and `AFFILIATE_KILL_SWITCH=true`; deploy Preview.
4. Set `AFFILIATE_PROGRAM_LAUNCH_START_AT`, publish immutable Launch/Evergreen rule effective times, then enable flags strictly in order: `AFFILIATE_PUBLIC_PAGE` → `AFFILIATE_APPLICATIONS` → `AFFILIATE_PROVISIONAL_ACTIVATION` → `AFFILIATE_ATTRIBUTION` → `AFFILIATE_COMMISSION_SHADOW`.
5. Run Golden, replay, concurrency, refund/chargeback and reconciliation checks. Compare primary and independent audit calculators.
6. `AFFILIATE_COMMISSION_REAL` stays false until Shadow has no unresolved mismatch or Critical/High issue.
7. `AFFILIATE_TEAM_REWARDS` stays false until direct-generation invariants pass.
8. `AFFILIATE_PAYOUT_CREATION` and then `AFFILIATE_PAYOUT_EXECUTION` stay false until daily reconciliation, 72-hour frozen batch, verified payout identity and rollback drill pass.
9. Telegram stays last: Daily → Wins → Payout Notice. Configure its token/chat ID only in the deployment secret store, never in Git or chat.

## Immediate rollback

Set `AFFILIATE_KILL_SWITCH=true`. This closes every Affiliate capability without affecting customer login, payment, subscription, Credits or detection. Preserve outbox and provider webhooks so already-received facts remain auditable. Do not delete financial records. Correct history with compensating entries.

## Required monitoring

- Outbox age, attempts and dead-letter count.
- Provider events versus sales, decisions, ledger entries and payout items.
- Primary versus audit calculator mismatch.
- Duplicate provider transaction/fingerprint attempts.
- Refund, dispute and chargeback clawbacks.
- Payout batch freeze age and reconciliation status.
- Telegram duplicate, retry, dead-letter and pause state.

## HumanOps checklist

- Production migration reviewed and separately authorized.
- Preview evidence retained; backup/rollback plan confirmed.
- Telegram bot created, official channel verified, bot made admin, six current messages synchronized and first two pinned.
- Payout provider account and legal/KYC handling approved.
- Production flags changed one at a time with evidence between steps.
- No real win or payout notice until its database status is qualified or paid+reconciled respectively.
