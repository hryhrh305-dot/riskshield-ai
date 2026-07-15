# Secwyn E8.6 Claim Guardrails

## Claim register

| Claim | Status | Evidence | Allowed wording | Forbidden wording | Affected pages | Owner | Review date |
|---|---|---|---|---|---|---|---|
| Secwyn is second-line pre-send risk governance | Verified | Current Web, API, Sheets decision workflow and E8.5 parity tests | “Second-line pre-send risk governance” | “Complete deliverability platform” | Home, metadata, pricing, docs | Product | 2026-07-15 |
| Available signals become Send/Review/Suppress decisions | Verified | Canonical decision model and cross-surface tests | “Turn available signals into…” | “Every signal is always verified” | Home, docs, pricing | Product + Engineering | 2026-07-15 |
| Web user run supports up to 5,000 contacts | Verified | Current Web bulk client/run contract | “Up to 5,000 contacts per Web run” | “5,000 free” or “all plans include 5,000 monthly” | Home, bulk metadata | Engineering | 2026-07-15 |
| 50-credit evaluation is one-time | Verified | Current Free plan constant and E8.6 test | “50 one-time contact checks” | “50 free every month” | Home, pricing, FAQ | Product + Billing | 2026-07-15 |
| Web/API/Sheets use the canonical decision model | Verified | E8.5/E8.6 parity suite, mismatch 0 | “Same canonical decision model” | “Every surface exposes identical fields” | Home, docs, Sheets guide | Engineering | 2026-07-15 |
| Paid-vendor data may enrich enabled requests | Partial | Feature/config dependent; production use must be request-proven | “Only when enabled and actually queried” | “Every audit includes paid-vendor data” | FAQ, evidence boundary | Engineering | Before any flag activation |
| Signup/form-abuse review | Future | Blueprint direction; no released production workflow | “Developing” / “Future direction” | “Detects signup fraud today” | Home ICP, FAQ | Product | Before public release |
| Inbox, delivery, revenue, or abuse prevention outcome | Prohibited | No system can establish or warrant these outcomes from current evidence | “Does not guarantee…” | Any positive guarantee | All public pages and outreach | Product + Legal | Every copy release |

## Pricing payment claim register

| Claim | Status | Evidence | Allowed wording | Forbidden wording | Qualification | Affected pages | Owner | Review date |
|---|---|---|---|---|---|---|---|---|
| European customers can pay for USD subscriptions | Verified with qualification | Current USD Creem product mapping and Creem checkout/payment-method documentation | Eligible European customers can generally pay using supported methods shown at checkout | All customers or cards are guaranteed; Secwyn supports USD and EUR checkout | Availability depends on location, billing address, device, product type, price, issuer, and payment provider | Pricing FAQ | Product + Billing | 2026-07-15 |

Additional payment guardrails:

- Prices remain USD. A customer's provider may convert the charge and determine its own exchange rate or fee; Secwyn does not set or collect that fee.
- Creem handles applicable taxes as Merchant of Record and confirms them during checkout.
- Do not guarantee every European customer, card, country, or local payment method.
- Do not claim that Secwyn offers EUR products, automatically bills in local currency, controls exchange rates, or guarantees no conversion or bank fee.

## Approved claim patterns

- “Second-line pre-send risk governance.”
- “Approve high-value campaigns before the first send.”
- “Turn available signals into Send, Review, and Suppress decisions.”
- “Traceable reasons,” “client-ready evidence,” and “aligned Web, API, and Google Sheets decisions” when describing the current canonical contract.
- “Up to 5,000 contacts per Web run” when clearly separated from monthly plan allowance.
- “50 one-time credits” for new accounts.
- “Cached results return faster and remain chargeable.”
- “Downloads of already completed audits do not consume another credit.”

## Claims requiring qualification

| Topic | Required qualifier |
|---|---|
| Signal coverage | Say “available signals”; do not imply every signal is always queried or conclusive. |
| Inbox/deliverability | Say Secwyn supports pre-send judgment; explicitly reject guarantees. |
| Paid vendor data | Claim only when the relevant request actually queried it and the configuration is enabled. |
| Cross-surface consistency | Same canonical decision model; field presentation and plan visibility can differ. |
| Future abuse workflows | Label “Developing” or “Future direction”; never production-ready. |
| Business tier | Custom capacity, API requirements, onboarding, and agreed terms; do not invent fixed entitlements. |
| Sample output | Label illustrative; never present as a customer result or measured performance proof. |

## Forbidden claims

- Guaranteed inbox placement, delivery, sender reputation, revenue, bounce reduction, or campaign performance.
- Guaranteed fraud, bot, signup, or form-abuse prevention.
- “AI” output when the displayed content is static, deterministic, cached without AI, or otherwise not produced by the described AI capability.
- Hidden free allowances such as recurring 50, 100, 5,000, or legacy sample/report offers.
- A paid-vendor lookup that did not occur.
- A roadmap capability as currently available.
- An invented customer, testimonial, benchmark, or ROI result.

## Review checklist

1. Is the capability available in the current code and enabled configuration?
2. Does the plan shown actually have access?
3. Is the allowance one-time, monthly, or custom—and stated correctly?
4. Is cached usage described as charged?
5. Are unknown signals preserved?
6. Is any illustrative material labeled?
7. Is a future capability labeled as future?
8. Would the claim remain true across Web, API, and Sheets under the canonical decision contract?
