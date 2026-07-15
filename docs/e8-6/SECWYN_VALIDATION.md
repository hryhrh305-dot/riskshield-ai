# Secwyn E8.6 Validation

Date: 2026-07-15

Repository: `D:/ai-saas-mvp`

Baseline commit: `941dec82226509fc79ce4290eabb44a3f311185c`

## Outcome

**PASS WITH KNOWN BASELINE** — the E8.6 positioning, claim guardrails, theme behavior, browser evidence, tests, and production build pass. Existing full-repository lint and TypeScript debt is unchanged from the E8.5 baseline and introduces no E8.6-file errors.

## Automated validation

| Check | Result | Evidence |
|---|---|---|
| E8.6 positioning/theme contract | PASS | 8/8 tests in `tests/e8-6-positioning-theme.test.ts` |
| Full Vitest | PASS | 31 files, 213/213 tests |
| E8.5 decision integrity regression | PASS | Benchmark, canonical adapter, Web/API/Sheets parity, credits, referral, Auth, and Creem tests are included in the full suite |
| `npm run validate` | N/A | No `validate` script exists in `package.json` |
| Production build | PASS | Next.js 16.2.9 compiled and generated 52/52 pages |
| Targeted lint | PASS | E8.6 changed TS/TSX/test files: zero errors and warnings |
| Full lint | KNOWN BASELINE | 111 errors / 40 warnings before and after E8.6 |
| Full TypeScript | KNOWN BASELINE | 129 errors before and after E8.6 |
| E8.6-file lint/type errors | PASS | zero matches in post-change lint/type output |
| Canonical cross-surface mismatch | PASS | 0 field mismatches in the local deterministic parity suite |
| Credit reconciliation error | PASS | 0 local contract mismatches; accounting and reconciliation tests pass |
| Paid-vendor calls | PASS | 0 in local audit/report validation; no paid-vendor path or production configuration was invoked |
| Referral 10% | PASS | Existing tests preserve 50 / 250 / 1,500 rewards for Starter / Growth / Scale |
| Whitespace | PASS | `git diff --check` returned no whitespace errors |
| Protected-file diff | PASS | no diff under plans, risk engine, credits, API routes, Supabase, or Google Sheets add-on |

## Business-constant regression

- Free remains 50 one-time credits.
- Starter remains $49 and 500 contacts/month.
- Growth remains $249 and 2,500 contacts/month.
- Scale remains $1,499 and 15,000 contacts/month.
- Business remains custom.
- API and Google Sheets access remain Growth and Scale (Business custom).
- Web user-run maximum remains 5,000.
- Cached results remain charged; downloading an already completed audit does not add another charge.
- Decision boundaries remain ALLOW 0–25, REVIEW 26–65, BLOCK/SUPPRESS 66–100.

## Claim scan

Active public source was scanned for old product/domain identity, false AI preview labels, unsupported positive guarantees, legacy free allowances, and stale public capacity promises.

- No active public `RiskShield`, `574269.xyz`, or `AI Risk Summary` string remains.
- No positive inbox/delivery/revenue guarantee remains.
- No legacy 30/100/5,000 free promise remains.
- The only old-name scan hit is the non-visible password-recovery local-storage key `riskshield_reset_cooldown_until`; it was deliberately preserved to avoid changing protected authentication behavior.

## Browser and visual validation

The screenshot harness uses installed Chrome through Playwright and asserts:

- expected `data-theme` on every capture;
- exactly one theme toggle;
- correct accessible `aria-pressed` state;
- toggle persistence in `localStorage`;
- dark and light system-preference fallback when no explicit choice exists;
- no hydration, uncaught, type, or null-reference error on audited pages.

Generated evidence:

- `home-dark-desktop.png`
- `home-light-desktop.png`
- `home-dark-mobile.png`
- `home-light-mobile.png`
- `pricing-dark-desktop.png`
- `pricing-light-desktop.png`
- `login-dark-desktop.png`
- `login-light-desktop.png`
- `not-found-light-desktop.png`
- `dashboard-auth-boundary-dark.png`
- `dashboard-auth-boundary-light.png`
- `bulk-check-auth-boundary-dark.png`
- `bulk-check-auth-boundary-light.png`
- `risk-check-auth-boundary-dark.png`
- `risk-check-auth-boundary-light.png`

The intentional 404 capture reports the expected failed-resource console entry for the missing URL; it has no hydration or application-runtime error. Dashboard, bulk-check, and risk-check correctly redirect an unauthenticated browser to login while preserving the requested `next` route and both themes. Authenticated production credentials were not used solely for visual evidence, avoiding production-side effects.

Smoke coverage passed for `/`, `/pricing`, `/docs`, `/docs/google-sheets`, `/pre-send`, `/bulk-check`, `/risk-check`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/admin/e8`, `/blacklist`, and an intentional 404. Protected routes retained their current authentication redirects. `/admin/e8` retained its current unauthenticated/disabled 404 boundary. Homepage link checks confirmed workflow/sample anchors, Docs, Pricing, Login, Signup, Privacy, Terms, and support email targets.

## Visual review findings

- Dark mode remains the existing default when system preference is dark and no explicit selection exists.
- Light mode matches the user-approved warm editorial direction: ivory background, white cards, navy text, fine borders, restrained shadow, serif marketing headlines, and cyan functional accent.
- Desktop homepage hierarchy, plan table, login form, and 404 are readable with no clipping.
- Mobile homepage stacks cards and CTAs correctly; the theme control retains an accessible name while its visible label collapses.
- Status queues preserve text labels alongside color.

## Pricing FAQ Payment Clarification

**Result: PASS**

- Public copy now states that all Secwyn plans are listed and charged in USD.
- Eligible European and international customers are told they can generally use supported methods shown by Creem Checkout, without guaranteeing any customer, card, country, or local method.
- Payment-method availability is qualified by location, billing address, device, product type, and price; issuer and payment-provider limitations remain explicit in the claim register.
- Customers are told they do not need a U.S. bank card or separate USD account, while provider conversion, exchange rate, and conversion-fee responsibility remain qualified.
- Applicable checkout taxes are attributed to Creem as Merchant of Record.
- No EUR product, Secwyn-controlled conversion, local-currency guarantee, or fee-free claim was introduced.
- Existing Creem product IDs, USD mapping, monthly/yearly checkout logic, prices, capacities, credits, referrals, entitlements, API, and Google Sheets behavior were not changed.

Validation evidence:

| Check | Result | Evidence |
|---|---|---|
| Pricing payment contract | PASS | `tests/e8-6-pricing-payment-faq.test.ts`: 4/4 |
| Full Vitest | PASS | 32 files, 217/217 tests |
| Production build | PASS | Next.js 16.2.9 compiled and generated 52/52 pages |
| Targeted lint | PASS | Pricing page, payment FAQ test, and browser verifier: zero errors and warnings |
| Full lint | KNOWN BASELINE | 111 errors / 40 warnings, unchanged from E8.6 baseline |
| Full TypeScript | KNOWN BASELINE | 129 errors, unchanged from E8.6 baseline |
| Browser interaction | PASS | Native disclosure opened, closed, and reopened with the Enter key |
| Responsive/theme review | PASS | Desktop/mobile in dark/light; FAQ and page cannot be horizontally scrolled |
| Protected behavior | PASS | No diff in plans, Checkout/API routes, Creem mapping, credits, referrals, entitlements, Supabase, or Google Sheets |

Generated focused evidence:

- `pricing-faq-dark-desktop.png`
- `pricing-faq-light-desktop.png`
- `pricing-faq-dark-mobile.png`
- `pricing-faq-light-mobile.png`

The mobile-only comparison-table containment adjustment preserves the existing internal horizontal table scroll and keeps the sticky first column at `sm` and wider viewports. It does not change table contents or plan behavior.

## Scope confirmation

No database migration, environment modification, feature flag, payment action, SES action, push, or deployment was performed. E8.7 and E8.8 were not entered.
