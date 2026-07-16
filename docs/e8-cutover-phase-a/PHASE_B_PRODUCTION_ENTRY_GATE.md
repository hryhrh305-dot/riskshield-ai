# Secwyn E8 Cutover Phase A — Phase B Production Entry Gate

Decision date: 2026-07-16 (Asia/Shanghai)

## Current decision

**BLOCKED — do not start Phase B yet.**

Core V2 monthly/annual Test Mode payments, webhook entitlement writes, first service-month credits, public catalog behavior, and flag rollback mechanics passed. A fresh Legacy Growth Annual checkout also passed during rollback. Two required external-evidence/configuration gaps remain. The provider-side coupon gate passed by HumanOps confirmation on 2026-07-16.

## Required before Phase B authorization

1. Correct the branch-scoped Legacy Test mappings: all three monthly IDs must resolve in the same Test account, and Starter Annual must resolve to a Starter-named product. Re-run the affected checkout probes while V2 pricing is disabled.
2. Resolve or obtain Creem confirmation for the signed return-query mismatch; keep verification fail-closed. Re-run an authenticated Test checkout and confirm both return verification and webhook activation.

## Evidence already obtained

- Production branch/deployment topology and main-push risk documented.
- Independent Preview branch and URL created; Production aliases unchanged.
- Authenticated writes isolated from Production.
- Legacy public pricing regression passed.
- Legacy Growth Annual checkout, webhook activation, yearly entitlement, and first service-month grant passed during rollback.
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
