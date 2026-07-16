# Secwyn E8 Cutover Phase A — Creem Test Checkout Acceptance

Verified: 2026-07-16 (Asia/Shanghai)

## Real Creem Test Mode results

| Plan | Checkout | Success page | Granted checks | Entitlement |
|---|---|---|---:|---|
| Starter Monthly | Passed | Passed | 500 | Starter |
| Growth Monthly | Passed | Passed | 2,500 | Growth |
| Scale Monthly | Passed | Passed | 10,000 | Scale |
| Starter Annual | Passed | Passed | 500 for first service month | Starter yearly |
| Growth Annual | Passed | Passed | 2,500 for first service month | Growth yearly |
| Scale Annual | Not offered | Contact-only passed | None | Mapping recognized |
| Legacy Growth Annual during rollback | Passed | Passed through webhook state | 2,500 for first service month | Growth yearly |

Only Creem's documented Test Mode payment method was used; no real transaction was processed. Success evidence is retained under `screenshots/` without customer emails, Product IDs, or order IDs.

## Contract integrity

- The server chooses Product ID and price from the active catalog.
- The client cannot supply a Product ID, price, discount, or feature flag.
- Unknown Product mapping and Legacy/V2 bypass rejection are covered by automated tests.
- Monthly-to-monthly upgrades were reflected in the active entitlement and prior grants were revoked according to the existing payment-integrity logic.

## Known redirect issue

Creem's auxiliary signed return query was rejected with `401 invalid signature` even after implementing the documented sorted-parameter HMAC-SHA256 verification. The mismatch reproduced on a fresh authenticated Legacy Growth Annual checkout using the replacement Test API key. Safe temporary diagnostics tested documented and legacy variants and found no match; diagnostics were then removed.

The authoritative webhook completed activation and the authenticated success page displayed Growth with 2,500 available credits. Signature verification was not weakened or bypassed. Provider clarification or a separately reviewed server-to-server verification design is required before Production cutover.
