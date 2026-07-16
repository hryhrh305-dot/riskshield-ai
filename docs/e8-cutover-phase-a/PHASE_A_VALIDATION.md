# Secwyn E8 Cutover Phase A — Validation Record

Verified: 2026-07-16 (Asia/Shanghai)

## Automated gates

| Gate | Result | Notes |
|---|---|---|
| E8.5–E8.8 targeted tests | Passed | Payment integrity, webhook routing, annual lifecycle, referral, replay, and catalog contracts |
| Full `npm test` | Passed | 34 files, 234 tests |
| `npm run build` | Passed | Next.js middleware deprecation warning only |
| Targeted ESLint | Passed | Core Phase A modified files; route files retained pre-existing findings outside changed lines |
| Full `npm run lint` | Known baseline | 150 findings: 111 errors, 39 warnings; no broad cleanup authorized |
| `npx tsc --noEmit` | Known baseline | Existing repository type debt remains; Phase A middleware narrowing issue was fixed |
| Browser smoke | Passed with limitations | Public pricing, responsive modes, authenticated Dashboard, Test success pages, and portal inspected |
| `git diff --check` | Run at final commit gate | Must be clean before Phase A commit |

## Real external acceptance

- Six active Creem Test Products were visually confirmed.
- Six Test Mode checkout paths were paid using Creem's documented test method: five V2 paths and one Legacy Growth Annual rollback path.
- Webhook-driven monthly/annual activations and first service-month credits were checked in the isolated database and UI.
- The Legacy rollback payment produced one payment, one active yearly subscription, and one 2,500-credit grant after a successful webhook delivery.
- Annual and pricing feature-flag rollbacks were deployed and inspected.
- No Live Product, real payment, real refund, Production DB write, or Production deployment was performed.

## Screenshot set

Retained screenshots cover Legacy/V2 pricing in dark/light/mobile modes, monthly and annual success states, and the Test portal. Debug screenshots containing generated test identity or provider order details were removed.
