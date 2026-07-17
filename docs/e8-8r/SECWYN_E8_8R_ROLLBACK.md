# Secwyn E8.8R Rollback

## Code rollback

Use a normal `git revert` of the single E8.8R commit, then run E8.5/E8.6/E8.8R targeted tests, full tests and build. Never reset or force-push.

The decision change is isolated to the additional mailbox-unconfirmed override in `src/lib/decision-integrity.ts`; reverting restores the former REVIEW behavior. No historical result, ledger or payment data is rewritten.

## Preview rollback

Revert the Preview branch commit or redeploy the previous READY Preview. Do not change Production aliases.

## Pricing flags

If a later payment stage fails, disable annual self-serve first and Premium V2 public pricing second. Keep all Legacy and V2 Product mappings so existing subscriptions remain recognizable.

## Database

E8.8R creates no migration and performs no database write. No database rollback exists or is needed.
