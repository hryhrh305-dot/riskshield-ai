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
