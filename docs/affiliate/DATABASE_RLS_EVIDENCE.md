# Affiliate database and RLS evidence

## Static migration evidence

- One additive migration: `202607220001_india_affiliate_platform.sql`.
- 60 `affiliate_` tables and 18 Affiliate functions.
- Seven explicit owner/public policies plus a complete RLS/revoke loop.
- Anonymous/authenticated direct access is revoked except for narrowly defined owner/public reads and application insertion.
- Financial, operator, publication-claim, rule-publication and transactional write RPCs are service-role only.
- Published rules, decisions, audits, ledger entries, schedules, paid/reconciled payout snapshots, and published content are protected from destructive mutation.
- Provider transaction, decision fingerprint, ledger key, application, attribution, content, and Telegram daily uniqueness are enforced in PostgreSQL.
- Foreign-key supporting indexes are generated for every single-column Affiliate foreign key.

## Runtime evidence

Runtime result: **not yet available**.

The isolated Preview project was verified empty before execution. `apply_migration` repeatedly failed at the Supabase management transport layer, including a one-statement `create extension if not exists pgcrypto` probe. `list_migrations` subsequently returned an empty list. No DDL was sent through `execute_sql`, because bypassing the migration runner would weaken auditability.

Required after transport recovery:

1. Apply the migration through the migration runner.
2. Verify all tables have RLS enabled and public/anon grants are absent.
3. Test anonymous, authenticated owner, authenticated non-owner and service-role access.
4. Test immutable triggers, all unique constraints and invalid state transitions.
5. Run concurrent application review, decision, reversal, outbox and Telegram claims.
6. Confirm only one worker owns each claimed record and duplicate requests replay without duplicate financial rows.

