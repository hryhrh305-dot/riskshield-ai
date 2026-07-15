# Secwyn E8.8 Human Operations Cutover Guide

This guide is not an authorization record. None of these production actions was performed during E8.8 local implementation.

## Safe sequence

1. Push the reviewed E8.8 commit and create a Preview deployment with both new flags false.
2. Verify Legacy monthly/annual Pricing, Checkout, Webhook recognition, Dashboard capacity, Portal, Credits and referral behavior.
3. In Creem Live, create distinct V2 monthly products at $199 / $999 / $3,999 and annual products at $2,189 / $10,989 / $43,989. Do not reuse Legacy IDs.
4. Configure all six V2 Product IDs in Preview. Keep both flags false and check for duplicate mappings.
5. Audit Creem coupon eligibility. V2 annual products must not accept ordinary coupon stacking.
6. Enable only `SECWYN_PREMIUM_PRICING_V2_ENABLED=true` in Preview. Verify V2 monthly prices/capacities; annual Starter/Growth remain contact/not self-serve; Scale annual remains contact-led.
7. Complete authenticated Preview checkouts using Creem Test Mode: one V2 monthly and one V2 annual Starter or Growth. Verify transaction, subscription snapshot, first monthly grant, Dashboard capacity, Portal and referral snapshot.
8. Advance a controlled non-production annual fixture across a service-month boundary. Verify exactly one next grant, replay idempotency, maximum 12, scheduled-cancel continuation and refund/dispute stop.
9. Enable `SECWYN_V2_ANNUAL_SELF_SERVE_ENABLED=true` only in Preview. Verify Starter/Growth checkout and Scale annual block.
10. Exercise rollback: annual flag false, then V2 flag false. Verify existing V2 product recognition and entitlements remain intact.
11. Request separate production authorization. Add production Product IDs with flags false, deploy, and repeat Legacy regression before any flag rollout.
12. Enable V2 monthly first. Observe payment/webhook/credit/referral logs. Enable annual self-serve only after real monthly acceptance and a separately authorized annual payment.

## Immediate stop signals

- Unknown/duplicate Product ID, price mismatch, wrong catalog generation or wrong plan.
- More than one grant for a service month, more than 12 grants in a term, upfront annual capacity or a negative balance.
- Legacy Scale shown or granted 10,000, or V2 Scale shown or granted 15,000.
- V2 annual coupon stacking, Scale annual self-serve, referral reward based on annual price, or replay creating a new reward.
- Portal loses an active Legacy/V2 subscription or cancellation removes access before the paid term without an immediate termination/refund.

Rollback is flag-first. Never delete legacy Product IDs or ledger history during rollback.
