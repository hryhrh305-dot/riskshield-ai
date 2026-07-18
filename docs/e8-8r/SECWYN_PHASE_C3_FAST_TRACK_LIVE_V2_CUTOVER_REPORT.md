# Secwyn Phase C3-F Live Premium V2 Cutover Report

Date: 2026-07-19 (Asia/Shanghai)

## Outcome

Secwyn Premium V2 is enabled for the public Production pricing catalog at `https://www.secwyn.com`.

- Public catalog generation: `premium_v2`
- Purchase mode: `live`
- Annual self-serve: enabled for Starter and Growth
- Scale annual: contact sales only
- Administrator Test Checkout: disabled
- Test and Live billing paths: still isolated
- Database migrations: none
- Test payments during this cutover: none
- Live payments during this cutover: none

## Production Contract

| Plan | Monthly price | Annual price | Credits per service month | Monthly checkout | Annual checkout |
| --- | ---: | ---: | ---: | --- | --- |
| Starter | $199 | $2,189 | 500 | Live | Live |
| Growth | $999 | $10,989 | 2,500 | Live | Live |
| Scale | $3,999 | $43,989 | 10,000 | Live | Contact sales |

Annual pricing continues to mean 12 service months for the price of 11. Credits are issued monthly rather than granted upfront for the full term.

## Live Product Verification

The project owner verified all six Creem Live products before cutover. No Product ID is recorded here.

| Product | Environment | Amount | Currency | Period | Mapping | Active | Public behavior |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| Starter Monthly | Live | 199 | USD | Monthly | Present | Yes | Checkout |
| Growth Monthly | Live | 999 | USD | Monthly | Present | Yes | Checkout |
| Scale Monthly | Live | 3,999 | USD | Monthly | Present | Yes | Checkout |
| Starter Annual | Live | 2,189 | USD | Annual | Present | Yes | Checkout |
| Growth Annual | Live | 10,989 | USD | Annual | Present | Yes | Checkout |
| Scale Annual | Live | 43,989 | USD | Annual | Present | Yes | Contact sales |

Production server-only mappings verified as present:

- `CREEM_STARTER_MONTHLY_V2_PRODUCT_ID`
- `CREEM_GROWTH_MONTHLY_V2_PRODUCT_ID`
- `CREEM_SCALE_MONTHLY_V2_PRODUCT_ID`
- `CREEM_STARTER_ANNUAL_V2_PRODUCT_ID`
- `CREEM_GROWTH_ANNUAL_V2_PRODUCT_ID`
- `CREEM_SCALE_ANNUAL_V2_PRODUCT_ID`

The Live API key and Live webhook secret remain present, server-only, and unchanged. Test and Live variables remain separate.

## Feature Flags

| Flag | Before cutover | After cutover | Scope | Client-visible | Rollback value |
| --- | --- | --- | --- | --- | --- |
| `SECWYN_PREMIUM_PRICING_V2_ENABLED` | `false` | `true` | Production | No | `false` |
| `SECWYN_V2_ANNUAL_SELF_SERVE_ENABLED` | `false` | `true` | Production | No | `false` |
| `SECWYN_ADMIN_TEST_CHECKOUT_ENABLED` | `false` | `false` | Production | No | `false` |

The public generation decision is read in `src/lib/admin-v2-canary.ts`. Checkout availability and annual self-serve state are resolved in `src/lib/pricing-catalog-response.ts` and `src/lib/billing-catalog.ts`.

## Compatibility Guarantees

- Existing Legacy Product ID snapshots remain immutable.
- Existing Legacy subscribers retain their Legacy prices, capacities, and referral generation.
- Legacy Scale remains 15,000 contacts per service month with a 1,500-credit referral reward.
- Premium V2 Scale uses 10,000 contacts per service month with a 1,000-credit referral reward.
- Free remains 50 one-time checks.
- API and Google Sheets remain Growth and Scale only.
- Web list audits remain capped at 5,000 contacts per run.
- Cached results continue to consume credits.
- Scoring and decision boundaries remain unchanged.

## Root Cause Fixed Before Cutover

The initial cutover attempt exposed a fail-safe mismatch: the global Premium V2 flag affected Checkout but was not connected to the public Pricing Catalog response. This could have displayed Legacy prices while selecting Premium V2 checkout mappings.

Production was immediately restored to Legacy before any checkout was created. The fix now makes the server-side Pricing Catalog and Checkout select the same catalog generation. Scale annual is explicitly kept contact-only.

Changed production code:

- `src/lib/admin-v2-canary.ts`
- `src/lib/pricing-catalog-response.ts`

Contract coverage:

- `tests/e8-8r-admin-v2-canary.test.ts`

## Validation

- Full Vitest suite: 338/338 passed
- Creem Node contract suite: 21/21 passed
- Targeted ESLint: passed
- Production build: passed, 55 routes/pages generated
- `git diff --check`: passed
- Production public routes: healthy
- Pricing Catalog: Premium V2 prices, capacities, purchase modes, and annual rules verified
- Sensitive provider identifiers in public catalog response: none
- Unauthenticated checkout request: rejected with HTTP 401
- Runtime errors after deployment: none during the acceptance window

Browser matrix:

| View | Theme | V2 prices | Horizontal overflow |
| --- | --- | --- | --- |
| Desktop | Light | Correct | None |
| Desktop | Dark | Correct | None |
| Mobile | Light | Correct | None |
| Mobile | Dark | Correct | None |

Production routes verified healthy: Homepage, Pricing, Signup, Login, Docs, Google Sheets Docs, Sample Audit, Dashboard authentication redirect, Live/Test Portal rejection without authentication, and Live/Test Webhook rejection without a valid signature.

## Data Delta

No payment was completed and no entitlement was provisioned during the authenticated acceptance procedure. Seven unpaid pending/abandoned Live Checkout sessions were created and accepted by the project owner as a HumanOps exception; they were not deleted or modified.

| Store | Baseline | After acceptance window | Delta |
| --- | ---: | ---: | ---: |
| Test payments | 26 | 26 | 0 |
| Test webhook events | 2 | 2 | 0 |
| Test subscriptions | 1 | 1 | 0 |
| Test credit grants | 1 | 1 | 0 |
| Test referral snapshots | 1 | 1 | 0 |
| Live completed payments | 1 | 1 | 0 |
| Live subscriptions | 0 | 0 | 0 |
| Live credit grants | 41 | 41 | 0 |

| Live referral grants | 0 | 0 | 0 |

| Live pending/abandoned Checkout sessions | 0 planned | 7 actual | +7 |

No transaction, subscription, credit grant, referral grant, webhook processing, Test data change, or Live entitlement change occurred. The seven pending records are immutable audit records and were not deleted, status-edited, or backfilled.

### HumanOps Exception — Multiple Unpaid Checkout Sessions

- Intended session count: 1
- Actual session count: 7
- Pending/abandoned count: 7
- Completed count: 0
- Transactions: 0
- Subscriptions: 0
- Credits: 0
- Referrals: 0
- Owner acceptance: accepted as a non-blocking HumanOps exception

This is not a payment failure, data pollution, security incident, or Production deployment blocker. Duplicate Checkout Session Prevention remains a separate P2 follow-up and is not implemented in this documentation-only closure.

## Production Observation

The Live Checkout acceptance window was observed for more than 10 minutes after the final Starter Monthly session. Production contained 149 HTTP 200 responses, 118 HTTP 304 responses, and one expected HTTP 307 redirect in the observation window. There were no 4xx or 5xx responses in the final observation window and no runtime error cluster. No webhook was received because no payment was completed.

Known baseline warnings remain isolated:

- The repository has no `npm run validate` script.
- Node reports the existing module-type warning for the standalone Creem test.
- Next.js reports the existing middleware convention deprecation warning.

## Release Identity

- Git commit: `a154f03` (`Fix global Premium V2 catalog generation`)
- Branch merged to: `main`
- Production deployment: Ready
- Production alias: `https://www.secwyn.com`

No Secret, Product ID, allowlist, customer identity, or payment instrument is recorded in this report.

## Phase C3-FR1 Final HumanOps Exception Closure

Final status: **PASS WITH HUMANOPS EXCEPTION**

- Premium V2 Public Catalog: ON
- Premium V2 Live Checkout: ON
- Live Checkout Host: VERIFIED
- Test Checkout: OFF
- Payment executed: No
- Seven pending records: Accepted HumanOps exception
- Completed payment delta: 0
- Subscription delta: 0
- Credits delta: 0
- Referral delta: 0
- Test pollution: No
- Live pollution: No
- Production deployment: Unchanged / READY
- Controlled GTM: READY
- SES: Paused
