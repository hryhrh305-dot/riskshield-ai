# Secwyn E8 Cutover Phase A — Creem Test Webhook Acceptance

Verified: 2026-07-16 (Asia/Shanghai)

## Externally observed Test Mode behavior

- Five distinct monthly/annual subscription grants were created from successful Test Mode subscription activations.
- Starter, Growth, and Scale monthly entitlements reached the Dashboard with 500, 2,500, and 10,000 checks respectively.
- Starter and Growth annual entitlements created only the first service-month grant (500 and 2,500), not the entire annual quantity.
- Existing V2 Test subscriptions remained recognizable while public V2 flags were disabled and after flags were restored.

## Automated/fixture coverage, not claimed as real provider events

- exact duplicate webhook replay;
- out-of-order event handling;
- unknown Product rejection;
- month 12 grant, month 13 rejection, and annual renewal term;
- scheduled cancellation;
- refund, dispute, chargeback, and past-due behavior;
- referral monthly/annual reward sizing, replay safety, and no annual amplification.

No real refund, cancellation, dispute, chargeback, natural renewal, or 30-day referral maturity was executed in Phase A.

## Redirect versus webhook

The webhook is the authoritative entitlement writer. The return-page signature mismatch described in `CREEM_TEST_CHECKOUT_ACCEPTANCE.md` did not cause an extra grant and was not bypassed.
