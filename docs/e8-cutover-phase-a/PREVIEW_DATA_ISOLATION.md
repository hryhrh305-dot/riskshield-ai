# Secwyn E8 Cutover Phase A — Preview Data Isolation

Verified: 2026-07-16 (Asia/Shanghai)

## Isolation used

Phase A authenticated and payment acceptance used a temporary local Supabase stack exposed to the Preview deployment through a temporary HTTPS tunnel. Branch-scoped Vercel variables pointed only the `secwyn-e8-cutover-preview` branch at that stack.

- Production Supabase was not used for test users or writes.
- `Flowwyn-dev` was not used.
- Production database migrations were not run.
- No repository migration was created for the temporary schema alignment.
- The temporary database received only generated Phase A users, Test Mode subscriptions, Test Mode payments, credit grants, and related acceptance records.
- No production user email, subscription, credit ledger entry, or referral record was copied into the isolated database.

## Temporary schema alignment

The isolated database needed small test-only alignment for columns/tables already assumed by current application code:

- provider product/customer identifiers on payment/subscription records;
- a minimal `scan_history` table used by the Dashboard read path.

These changes existed only in the disposable Phase A database and are not production migrations.

## Data evidence

At the end of the real Test Mode checkout run, the isolated database contained:

- 6 completed Test Mode payment rows;
- 5 active subscription records across the generated test users;
- 5 subscription credit grants, totalling 16,000 checks;
- no real-payment referral reward event.

The additional completed payment did not create an additional subscription grant. Exact webhook replay idempotency remains covered by automated tests, not by claiming that this count alone proves a provider replay.

## Secret and identity policy

No API key, webhook secret, database URL, password, full Product ID, generated test email, or provider order ID is stored in the committed documentation or retained screenshots.

## Phase A closeout

After evidence collection, the branch-scoped Supabase/database and Creem write credentials were replaced with nonfunctional fail-closed placeholders before the final Preview deployment. This prevents the branch from falling back to Production credentials after the temporary stack is stopped. The final public Preview can still demonstrate pricing/catalog UI, but authenticated checkout/write acceptance requires a newly authorized isolated environment.
