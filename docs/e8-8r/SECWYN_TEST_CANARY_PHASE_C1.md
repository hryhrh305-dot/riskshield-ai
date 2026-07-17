# Secwyn E8.8R Phase C1 — Test Canary Billing Isolation

Date: 2026-07-17

Status: compatible code prepared; Production migration and Test configuration not applied; Test checkout remains disabled.

## Isolation decision

Phase C uses Option B: Test Canary evidence is stored in dedicated tables. Test payments, subscriptions, service-month credit evidence, referral snapshots and webhook idempotency records never enter the Live billing or credit ledgers. Test credits are evidence only and cannot be consumed by normal checks or shown as the account's Live balance.

This avoids modifying historical Live rows, Live uniqueness constraints, entitlement selection, dashboard balances, credit reconciliation or referral maturity.

## Additive migration

The unapplied migration creates only:

- `test_canary_webhook_events`
- `test_canary_payments`
- `test_canary_subscriptions`
- `test_canary_credit_grants`
- `test_canary_referral_snapshots`
- `process_test_canary_webhook_event(...)`

Every table has a fixed `test_canary` environment check, environment-scoped unique indexes, RLS, revoked public/anonymous/authenticated access, and service-role-only access. Foreign keys use `ON DELETE RESTRICT`. The RPC serializes each provider event with a transaction advisory lock and treats the webhook as the only authority that can create subscription, grant and referral evidence.

The migration does not alter or write `payments`, `subscriptions`, `credit_grants`, `referral_attributions`, `profiles`, RLS policies for existing tables, or any Live index.

## Route isolation

- Existing Live checkout and Live webhook remain unchanged for Legacy users.
- Test checkout is reachable only when both administrator Canary verification and the exact Test checkout flag pass, and all server-only Test mappings are complete.
- Test checkout uses the fixed Creem Test API host and dedicated Test key namespace.
- Test webhook has a separate endpoint and verifies only the dedicated Test webhook secret.
- Test redirect uses the dedicated Test API key with the confirmed ordered plain SHA-256 contract. It displays stored status only and cannot grant credits or referrals.
- Test Portal has a separate authenticated endpoint. It opens only when an active subscription exists in the isolated Test subscription table and then uses the Test API host/key.
- Unknown, incomplete or mismatched environment/product/user context fails closed.

## Safe deployment before migration

With `SECWYN_ADMIN_TEST_CHECKOUT_ENABLED` missing or exactly `false` and Test secrets/mappings missing:

- all V2 purchase buttons remain locked;
- the checkout route returns the existing Phase B disabled response before reading any Test table;
- Legacy checkout, webhook and Portal continue using their existing Live configuration;
- no Test table or RPC is required by ordinary Production traffic;
- the Test webhook and Test Portal fail closed because their Test configuration is absent.

Therefore compatible code may be deployed before the migration while all Test flags remain off. The migration must be applied before any Test variable is configured or Test checkout is enabled.

## Phase C2 HumanOps order

Phase C2 requires separate user authorization. The safe order is:

1. Apply the reviewed additive migration to Production.
2. Add the dedicated Test key, webhook secret and six Test Product mapping variables to Vercel Production without changing any Live variable.
3. Configure the Creem Test Mode webhook to `/api/payment/webhook/creem-test-canary`.
4. Redeploy while `SECWYN_ADMIN_TEST_CHECKOUT_ENABLED=false`.
5. Verify ordinary Legacy Live behavior and the disabled administrator V2 buttons.
6. Stop at the payment HumanOps Gate. Do not enable Test checkout or pay without new explicit authorization.

## Rollback

First keep or set `SECWYN_ADMIN_TEST_CHECKOUT_ENABLED=false` and redeploy. If the compatible code has a P0 issue, alias Production back to the previous Ready deployment and use a normal Git revert. Do not reset, rebase, force-push, delete the additive tables, or remove Test evidence. No destructive down migration is provided.
