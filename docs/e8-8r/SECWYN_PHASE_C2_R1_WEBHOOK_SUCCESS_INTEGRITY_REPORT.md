# Secwyn Phase C2-R1 Webhook and Success Integrity Report

## Scope

This repair is limited to the isolated Creem Test Canary path. It does not alter Live checkout, Live webhook processing, Live credits, referrals, pricing, scoring, Supabase schema, RLS, or SES.

## Evidence and root cause

- Creem reached `/api/payment/webhook/creem-test-canary` and passed the dedicated Test HMAC and Canary context checks.
- The isolated database RPC rejected the documented `checkout.completed` payload because the old parser did not read the checkout identifier from `object.id`.
- The RPC also rejected the documented `subscription.paid` payload because the old parser did not read the subscription identifier from `object.id`, transaction identifier from `last_transaction_id`, or amount from `product.price`.
- The billing success page only recognized a Test return when the confirmation request returned an HTTP success. A Test redirect verification failure therefore fell through to the existing Live account lookup. An already-active Live Business account could then display a false activation message unrelated to the Test payment.

The Test webhook failures are therefore a payload-field mapping defect, not evidence of a missing webhook delivery or a Live billing defect.

## Repair

- Added event-specific normalization for the documented Creem `checkout.completed` and `subscription.paid` shapes.
- Kept the dedicated Test webhook secret, Test Product mapping, server-verified Canary actor, isolated RPC, and idempotency boundary unchanged.
- Added allowlisted, non-sensitive webhook processing diagnostics.
- Added explicit redirect failure codes that distinguish missing authentication from invalid Test redirect signatures without exposing keys, Product IDs, signatures, or account identifiers.
- Made the Test success page authoritative-state aware:
  - return link unverified;
  - signed return verified, webhook pending;
  - Test payment recorded, isolated provisioning pending;
  - isolated payment, subscription, and evidence-only grant confirmed;
  - Test billing failed.
- A Test return no longer falls through to Live account state and cannot present an existing Live plan as proof that the Test purchase succeeded.

## Database and environment impact

- No migration.
- No schema or RLS change.
- No manual edits to the first pending Test payment.
- No Test webhook replay.
- No Live Creem variable, Product mapping, webhook, subscription, credit, or referral change.
- Test Checkout remains disabled during repair deployment.

## Verification contract

Synthetic fixtures cover the official event shapes and verify checkout, transaction, subscription, customer, amount, period, and metadata normalization. Existing HMAC, unknown Product, Canary actor, isolated RPC, Portal, redirect, idempotency, credits, referral, and Live-separation tests remain mandatory.

The final Production Test acceptance must prove that one new Test payment creates only isolated Test records and leaves the pre-test Live plan, Live balance, Live payment count, Live grants, and Live referrals unchanged.

## Rollback

1. Keep `SECWYN_ADMIN_TEST_CHECKOUT_ENABLED` false.
2. Roll the Production alias back to the previous Ready deployment if a P0 appears.
3. Use a normal Git revert for this repair commit.
4. Do not delete the additive Test tables or any Test or Live billing evidence.
