# Secwyn Credit Ledger Production Runbook

This runbook is for the Secwyn repository at `D:/ai-saas-mvp` and Supabase project `njhjiavnidssjvnkcxfo`. It does not authorize production work by itself. Production SQL, Vercel environment changes, push, and deployment require explicit user approval.

## Release invariants

- Free 50, Starter 500, Growth 2,500, Scale 15,000; Business remains contract/manual.
- Cache hits are charged. Risk thresholds remain 0–25 / 26–65 / 66–100.
- `profiles.credits_remaining` must equal currently usable contact-audit grants for every user.
- The cutover must preserve every pre-cutover balance exactly; it must not top up any account.
- Migration `202607130004` is immutable. New behavior is introduced by `005` through `008`.

## 1. Identity and migration-history preflight (read-only)

Confirm Git root, branch, cleanliness, remote, and divergence. Confirm the Supabase project ref and Vercel project before reading or changing production.

```sql
select version from supabase_migrations.schema_migrations order by version;
select plan, subscription_status, count(*), sum(credits_remaining)
from public.profiles group by plan, subscription_status order by plan, subscription_status;
select id, plan, credits_remaining from public.profiles
where credits_remaining is null or credits_remaining < 0;
select count(*) from public.credit_grants;
select provider, provider_transaction_id, count(*)
from public.payments where provider_transaction_id is not null
group by provider, provider_transaction_id having count(*) > 1;
select payment_provider, provider_subscription_id, count(*)
from public.subscriptions where provider_subscription_id is not null
group by payment_provider, provider_subscription_id having count(*) > 1;
```

Stop if the invalid-balance query returns rows, provider IDs are duplicated, a ledger table exists outside migration history, or paid subscriptions have ambiguous/missing provider identity. Do not normalize negative/NULL balances and do not guess anchors. Such users require explicit correction or the exception/manual path before cutover.

## 2. Backup before writes

Export affected production rows to an access-controlled location without printing secrets:

- `profiles`: id, plan, subscription status/start/end, credits, created/updated time
- `subscriptions`: provider IDs, plan/status, periods, cancellation fields
- `payments`: IDs, provider identifiers, status, plan (exclude unnecessary PII)
- `referral_attributions` reward fields
- active `bulk_runs` and `bulk_run_chunks`

Record row counts and a SHA-256 checksum of each export. Do not store exports in Git.

## 3. Vercel environment gate

Generate a high-entropy `CRON_SECRET`, set it only in Vercel Production, and never print it. Confirm presence by variable name only. A production redeploy is required. An unauthenticated call to `/api/cron/credit-refresh` must return 401.

## 4. Maintenance window and migration order

Pause new paid scans during the ledger cutover. Verify no active bulk run is processing. Apply only missing migrations, in this order:

1. `202607130004_referral_reward_delivery.sql` only if migration history proves it was never applied.
2. `202607130005_credit_grant_ledger.sql`
3. `202607130006_subscription_billing_cycles.sql`
4. `202607130007_referral_reward_grants.sql`
5. `202607130008_credit_ledger_backfill.sql`

Never edit or re-run an already recorded historical migration by changing its contents. Use a new forward-fix migration if production differs from the expected schema.

## 5. Immediate database acceptance

```sql
select count(*) snapshots, sum(credits_remaining) snapshot_total
from public.credit_ledger_cutover_snapshots;

select count(*) exceptions from public.credit_ledger_backfill_exceptions;

select snapshot.user_id, snapshot.credits_remaining mirror_before,
  coalesce(sum(grant_row.remaining_amount) filter (
    where grant_row.credit_type='contact_audit' and grant_row.status='active' and grant_row.starts_at<=now()
      and (grant_row.expires_at is null or grant_row.expires_at>now())
  ),0) ledger_now
from public.credit_ledger_cutover_snapshots snapshot
left join public.credit_grants grant_row on grant_row.user_id=snapshot.user_id
group by snapshot.user_id,snapshot.credits_remaining
having snapshot.credits_remaining <> coalesce(sum(grant_row.remaining_amount) filter (
  where grant_row.credit_type='contact_audit' and grant_row.status='active' and grant_row.starts_at<=now()
    and (grant_row.expires_at is null or grant_row.expires_at>now())
),0);
```

The mismatch query must return zero rows. Review every exception, especially Business and paid accounts missing a provider-confirmed anchor. Confirm the designated Business test account balance is unchanged.

Verify catalog security: all ledger tables have RLS; anon/authenticated cannot execute accounting RPCs or update the mirror; service role can execute only the approved wrapper/consume/reservation/summary RPCs. Run Supabase security and performance advisors and separate new findings from existing technical debt.

## 6. Push and production acceptance

Only after database acceptance: push the approved commits once, wait for the Vercel production deployment to become READY, and confirm aliases include `www.secwyn.com`.

Verify:

- Cron route: no auth → 401; approved authenticated invocation → idempotent summary.
- Dashboard total equals ledger summary; Plan/Referral/Other and nearest expiry are correct.
- One paid single check and one cached repeat each charge exactly once.
- Web and Sheets 101-contact runs charge 101, return matching balances, and preserve detailed exports.
- Controlled 4,004- and 5,000-contact Web runs complete without one long Vercel request.
- Monthly/annual duplicate webhook replay creates one cycle grant.
- No production runtime errors or credit-mirror mismatches appear.

## 7. Rollback and forward-fix

Before traffic resumes, a direct application rollback is safe only if no ledger writes have occurred. After ledger writes begin, do not restore the original snapshot blindly: that would erase legitimate consumption and grants.

For an application failure after cutover:

1. Stop new credit writes and Cron.
2. Keep ledger tables and immutable usage history.
3. Recompute `profiles.credits_remaining` from usable grants at the rollback time.
4. Roll the application to the last compatible deployment or deploy a forward fix.
5. Re-enable traffic only after every mirror equals its ledger sum.

Do not drop ledger/history tables, reset balances to the cutover snapshot, or re-enable the legacy `consume_credit(uuid)` RPC. Record the incident timestamp, affected operations, deployment SHA, and reconciliation evidence.
