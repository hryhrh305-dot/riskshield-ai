# Secwyn E8 Cutover Phase A — Creem Test Product Matrix

Verified: 2026-07-16 (Asia/Shanghai)

All six products were created in Creem Test Mode and shown Active. Full Product IDs are intentionally omitted.

| Product | Interval | USD price | Public mapping | Test checkout |
|---|---:|---:|---|---|
| Starter V2 | Monthly | $199 | Checkout | Passed |
| Growth V2 | Monthly | $999 | Checkout | Passed |
| Scale V2 | Monthly | $3,999 | Checkout | Passed |
| Starter V2 | Annual | $2,189 | Checkout | Passed |
| Growth V2 | Annual | $10,989 | Checkout | Passed |
| Scale V2 | Annual | $43,989 | Contact-only | Public checkout intentionally blocked |

Annual prices equal eleven monthly payments. Scale Annual has a recognized server-side mapping but no public self-serve checkout.

## Coupon status

Application code does not send a coupon, discount, Product ID, or price selected by the client. HumanOps confirmed on 2026-07-16 that the existing Creem coupons do not apply to the V2 Annual products. No coupon stacking was observed or enabled by Secwyn.

## Legacy rollback mapping audit

The Legacy mappings are separate from the six accepted V2 Test Products. Legacy Growth Annual and Scale Annual resolved to the expected provider products, while the three Legacy monthly IDs were not found by the staged Test API key and Legacy Starter Annual opened a Scale-named product. These branch-scoped Test mapping errors must not be copied into Production.
