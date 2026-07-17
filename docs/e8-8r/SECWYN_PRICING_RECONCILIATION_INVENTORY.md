# Secwyn E8.8R Pricing Reconciliation Inventory

Verified 2026-07-17 against the current Preview branch.

| Surface | Source | Result |
|---|---|---|
| Canonical catalog | `src/lib/billing-catalog.ts` | Correct Legacy/V2 prices, capacities, referrals and Product env keys |
| Public Pricing API | `src/app/api/pricing-catalog/route.ts` | Server flag selects generation; returns no Product IDs |
| Pricing UI | `src/app/(dashboard)/pricing/page.tsx` | Prices, card capacity and Included checks use the public catalog; fallback is Legacy |
| Checkout | `src/app/api/create-checkout/route.ts` | Server derives generation, Product ID and amount; Scale annual contact-only |
| Webhook | `src/app/api/payment/webhook/route.ts` | Product ID resolves immutable catalog entry before grant/referral |
| Credit grants | `src/lib/subscription-credits.ts`, `src/lib/credit-reconciliation.ts` | Amount comes from catalog generation; annual uses service-month identity |
| Referral | `src/lib/referral-rewards.ts` | Reward comes from generation/plan/interval snapshot |
| Dashboard | `src/app/api/referrals/me/route.ts` | Stored subscription Product ID resolves displayed entitlement |
| Portal | `src/app/api/payment/customer-portal/route.ts` | Provider customer routing; does not infer a public catalog |
| API / Sheets | `src/lib/plan-entitlements.ts`, `src/lib/plans.ts`, v1 batch route, `google-sheets-addon/Code.gs` | Growth+ gate remains; canonical result is consumed, not recalculated in Sheets |
| Environment | `.env.example` | Legacy and six V2 Product IDs are separate; both rollout flags default false |

`src/lib/plans.ts` remains the Legacy compatibility plan table. It is not the Premium V2 payment catalog. `AGENTS.md` was corrected to state this split explicitly.

No pricing/payment/credit/referral implementation change was required by this reconciliation.
