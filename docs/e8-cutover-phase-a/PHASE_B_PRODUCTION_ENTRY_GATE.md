# Secwyn E8 Cutover Phase A — Phase B Production Entry Gate

Decision date: 2026-07-16 (Asia/Shanghai)

## Current decision

**BLOCKED — do not start Phase B yet.**

Core V2 monthly/annual Test Mode payments, webhook entitlement writes, first service-month credits, public catalog behavior, and flag rollback mechanics passed. Three required external-evidence gaps remain.

## Required before Phase B authorization

1. HumanOps inspects every active Creem promotion/coupon and proves V2 Annual Products cannot receive an unapproved stacked discount.
2. Provide valid Legacy Test Product mappings (or an explicitly approved equivalent Test environment) and complete one new Legacy checkout while V2 pricing is disabled.
3. Resolve or obtain Creem confirmation for the signed return-query mismatch; keep verification fail-closed. Re-run Starter Test checkout and confirm both return verification and webhook activation.

## Evidence already obtained

- Production branch/deployment topology and main-push risk documented.
- Independent Preview branch and URL created; Production aliases unchanged.
- Authenticated writes isolated from Production.
- Legacy public pricing regression passed.
- Six V2 Test Products active with correct monthly/annual prices.
- Starter/Growth/Scale monthly Test checkout passed.
- Starter/Growth annual Test checkout passed; Scale annual remained Contact-only.
- First annual service-month grants were correct and not upfront annual grants.
- Existing V2 subscriptions survived public flag rollback.
- Client Product/price/flag injection protections and lifecycle/idempotency contracts passed automated tests.
- Full test suite and production build passed.

## Still requires controlled Production/Live evidence in Phase B

- Live Products and Production Product IDs/environment variables;
- Production-compatible code deployment and Legacy Production regression;
- controlled real monthly payment, webhook, credits, portal, cancellation/refund procedure;
- controlled real annual payment and subsequent service-month operations;
- taxes/VAT, issuing bank, European payment behavior, and settlement;
- Production rollback timing and Live legacy/V2 mapping;
- Production monitoring and explicit user authorization for every Production mutation.

No main push, Production deployment, Live Product creation, real payment, Production database action, or Phase B action is authorized by this document.
