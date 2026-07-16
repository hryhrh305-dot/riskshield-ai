# Secwyn E8 Cutover Phase A — Legacy Preview Regression

Verified: 2026-07-16 (Asia/Shanghai)

## Public Legacy regression

Before enabling V2 flags, Preview was checked in dark and light modes. Legacy pricing, plan labels, monthly/annual presentation, public navigation, and existing report/UI behavior rendered without a new browser error. Evidence is retained in `screenshots/preview-legacy-pricing-dark.png` and `screenshots/preview-legacy-pricing-light.png`.

## Flag rollback drill

- Annual flag off: annual public checkout CTAs became Contact-only while existing yearly Test subscriptions remained recognizable.
- Pricing V2 flag off: public pricing returned to Legacy values while all existing V2 Test subscriptions remained recognizable in the isolated database.
- Flags restored: V2 monthly and annual public catalog returned correctly.

## External Legacy checkout retest

On 2026-07-16, a new authenticated **Legacy Growth Annual** checkout completed in Creem Test Mode while both public V2 flags were disabled. The isolated database recorded one completed Growth payment, one active yearly Growth subscription, and one 2,500-credit first service-month grant. The initial 50-credit free grant was revoked. The provider webhook returned `200` and did not create a second payment, subscription, or subscription grant.

This proves that the Legacy catalog generation, authenticated checkout route, webhook mapping, annual entitlement, and credit-grant path remain operational during the public rollback.

## Remaining Legacy Test mapping limitation

The replacement mappings were not all correct:

- all three Legacy monthly Product IDs returned provider `404 Product not found` for the staged Test API key;
- Legacy Starter Annual opened a Scale-named product;
- Legacy Growth Annual and Scale Annual resolved to the expected provider products.

Production was untouched and uses separate existing Live/Legacy configuration, so these Test-only mapping errors do not establish a Production regression. They do prevent a claim that every staged Legacy Test Product mapping passed. The four incorrect branch-scoped mappings must be corrected before using this Preview branch for a complete six-path Legacy rollback rehearsal.
