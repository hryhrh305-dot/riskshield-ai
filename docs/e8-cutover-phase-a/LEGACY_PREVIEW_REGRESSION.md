# Secwyn E8 Cutover Phase A — Legacy Preview Regression

Verified: 2026-07-16 (Asia/Shanghai)

## Public Legacy regression

Before enabling V2 flags, Preview was checked in dark and light modes. Legacy pricing, plan labels, monthly/annual presentation, public navigation, and existing report/UI behavior rendered without a new browser error. Evidence is retained in `screenshots/preview-legacy-pricing-dark.png` and `screenshots/preview-legacy-pricing-light.png`.

## Flag rollback drill

- Annual flag off: annual public checkout CTAs became Contact-only while existing yearly Test subscriptions remained recognizable.
- Pricing V2 flag off: public pricing returned to Legacy values while all existing V2 Test subscriptions remained recognizable in the isolated database.
- Flags restored: V2 monthly and annual public catalog returned correctly.

## Known rollback limitation

A new Legacy checkout could not be completed against the current Creem Test account. Creem returned `404 Product not found` because HumanOps staged only the six V2 Test Products and the Test API key could not resolve the configured Legacy Product IDs.

This does not show a Production Legacy failure: Production was untouched and uses its existing Live/legacy configuration. It does mean the task's requested **new Legacy Test checkout during rollback is not externally proven**, so the rollback acceptance item remains blocked until matching Legacy Test Products/IDs are available or an approved equivalent Test fixture is configured.
