# Secwyn E8 Cutover Phase A — Annual Service-Month Acceptance

Verified: 2026-07-16 (Asia/Shanghai)

## Real Test Mode evidence

- Starter Annual created a yearly subscription term and granted 500 checks for approximately one service month.
- Growth Annual created a yearly subscription term and granted 2,500 checks for approximately one service month.
- The provider portal displayed yearly billing and the correct annual price; it did not display or grant a whole-year contact allowance.
- Scale Annual displayed $43,989/year publicly but remained Contact-only.

## Automated lifecycle evidence

Tests cover deterministic service-month grant keys, idempotent re-entry, months 2 through 12, rejection of month 13, a new grant schedule after annual renewal, and stopping future grants after cancellation/refund/dispute/chargeback states.

## Evidence boundary

The test did not wait twelve calendar months. Month 12, month 13, renewal, cancellation, refund, dispute, and chargeback conclusions are automated fixture/simulation results, not natural elapsed-time or real provider-event evidence.
