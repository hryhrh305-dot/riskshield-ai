# Secwyn E8 Cutover Phase A — Preview Flag Rollback Drill

Verified: 2026-07-16 (Asia/Shanghai)

## Actual drill sequence

1. Set annual self-serve flag false and redeployed Preview.
   - Annual catalog reported disabled.
   - Starter, Growth, and Scale annual CTAs became Contact-only.
   - Two existing yearly Test subscriptions remained active/recognizable.
2. Set V2 pricing flag false and redeployed Preview.
   - Public catalog returned to Legacy pricing (including Starter $49 and Legacy Scale 15,000 checks).
   - All five existing V2 Test subscriptions remained active/recognizable.
3. Attempted a new Legacy Test checkout.
   - The initial mappings failed because the Test API key could not resolve the staged Legacy monthly products.
   - After HumanOps restaged Legacy mappings and the Test credential, a new authenticated Legacy Growth Annual checkout completed.
   - Webhook activation produced one active yearly Growth subscription and one 2,500-credit first service-month grant.
   - Mapping probes still found three invalid monthly IDs and a Starter Annual ID that opened a Scale-named product.
4. Restored V2 pricing and annual self-serve flags and redeployed Preview.
   - Monthly checkout, Starter/Growth annual checkout, and Scale annual Contact-only state returned.

## Result

- Flag mechanics: Passed.
- Existing V2 entitlement recognition with public flags off: Passed.
- Public Legacy catalog restoration: Passed.
- New Legacy Test payment during rollback: Passed for Growth Annual.
- Complete six-path Legacy Test mapping: Not passed; four branch-scoped mappings require correction.
- Production rollback: Not attempted in Phase A.

Rollback deployments completed on the normal Preview deployment timescale (roughly under one minute each); no Production recovery-time claim is made.
