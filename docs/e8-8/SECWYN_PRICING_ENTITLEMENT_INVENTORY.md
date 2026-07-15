# Secwyn E8.8 Pricing and Entitlement Inventory

Date: 2026-07-15

Source of Truth: Secwyn Blueprint v1.5.3 and the E8.8 single-agent task.

## Current state

- One global catalog is hard-coded in `src/lib/plans.ts`: Free 50 one-time, Starter $49/500, Growth $249/2,500, Scale $1,499/15,000, Business custom.
- `src/lib/creem.ts` adds legacy annual prices of $499/$2,499/$14,999 and resolves one monthly plus one yearly Product ID per plan.
- Pricing currently advertises “2 months free” and exposes annual checkout whenever a yearly Product ID exists.
- API and Google Sheets require Growth or above. Web list audit requires Starter or above.
- Core risk-engine thresholds are shared and must remain 0–25 / 26–65 / 66–100.
- Dashboard entitlement is derived from the stored profile/subscription, not the public pricing toggle.

## Required target

- Keep a read-only Legacy catalog for recognition and grandfathered renewals.
- Add a Premium V2 catalog selected only by server-side flags.
- Starter and Growth V2 annual checkout require both flags and a mapped Product ID.
- Scale V2 annual is always contact-led; Business remains custom.
- Missing or invalid flags and Product IDs fail closed.
- No public pricing mode may alter an existing subscriber’s stored entitlement.
