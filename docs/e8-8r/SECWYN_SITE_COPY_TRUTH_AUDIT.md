# Secwyn Site Copy Truth Audit

Date: 2026-07-18
Baseline: `a400b1612cf9a2b0adadfeb6ec77e0081f173ff7`
Scope: Phase B.5 copy and pricing-entitlement truth only

## Audit coverage

The audit covered all 19 route page components, 10 route metadata/layout surfaces, shared header/footer and home components, authenticated decision surfaces, pricing, API and Google Sheets documentation, billing states, HTML/print reports, and CSV/XLSX export labels. It also searched the repository-visible runtime copy for the prohibited legacy names, obsolete free mechanisms, unsupported guarantees, roadmap language, and conflicting decision labels.

Reviewed surfaces included `/`, `/pricing`, `/docs`, `/docs/google-sheets`, authentication pages, `/dashboard`, `/risk-check`, `/bulk-check`, `/pre-send`, billing success, blacklist, feedback/admin surfaces, legal pages, the 404 page, metadata, report preview, generated HTML reports, and spreadsheet exports.

## Findings and resolution

| Risk | Finding | Resolution |
|---|---|---|
| High | The homepage CTA called the one-time allowance an audit and could imply a free list audit. | Changed to “Start with 50 Free Checks”; routing remains signup for signed-out visitors and single-contact check for signed-in visitors. |
| High | Pricing described a daily contact allowance as “Audit runs per day.” | Renamed to “Daily contact processing limit”; values remain the existing plan limits. |
| High | Starter MX evidence was labeled “Deep,” although deep detection starts at Growth. | Starter now says “Standard”; Growth and Scale say “Extended.” |
| High | Roadmap items and two features without the advertised paid-plan gate were shown inside the current entitlement table. | Removed unproved history, reporting dashboard, risk-settings, blacklist-management, webhook, key-permission, custom-rule, team, priority, assistance, SLA, procurement, and white-label rows from the current-capability table. |
| High | Raw ALLOW/BLOCK labels appeared on customer-facing decision and export surfaces. | Presentation now maps ALLOW to SEND and BLOCK to SUPPRESS. Internal decisions, thresholds, persistence, API compatibility, and scoring are unchanged. |
| Medium | Pricing used an unproved campaign-cost comparison. | Replaced with a neutral service-month capacity instruction. |
| Medium | “Company health score” overstated the product position. | Renamed to “Domain health context,” matching the gated domain evidence returned from Growth upward. |
| Medium | API docs used “valid,” an AI explanation, and internal decisions as the primary contract. | Reframed examples around available evidence, `audit_queue`, primary reason, and recommended action. |
| Medium | Risk settings exposed internal BLOCK language. | Changed visible copy to Suppress/Review without changing setting keys or behavior. |
| Medium | Pre-send history showed “Blocked.” | Changed the visible label to “Suppressed”; stored counts and route behavior are unchanged. |
| Low | Loading states used three periods. | Changed touched states to the single ellipsis character. |

## Claims retained because they are proved

- Web runs accept at most 5,000 contacts; Starter remains limited to 500 per Web run.
- API and Google Sheets access start at Growth.
- CSV/TXT/XLSX input and CSV/XLSX result export start at Starter.
- Cached results remain chargeable because the same usable decision is returned.
- Downloading or printing completed results does not consume another audit credit.
- Decisions are SEND, REVIEW, and SUPPRESS in user-facing presentation while internal ALLOW/REVIEW/BLOCK codes remain compatible.
- Reports disclose that mailbox, delivery, inbox placement, revenue, and compliance are not guaranteed.

## C1 copy audit

C1 administrator-only states were reviewed. The checkout-lock message was made clearer: it states that administrator test checkout is disabled and the button cannot start a payment. Billing redirect copy continues to say that test records do not change a live plan, live credits, referral rewards, or production billing records. No C1 route, status code, authorization rule, webhook authority, portal selection, credit behavior, or referral behavior changed.

## Legal pages

Terms and Privacy contain legal disclaimers that use “guarantee” in the negative. Those statements were retained because they limit claims rather than promise outcomes. No liability, governing-law, refund, arbitration, privacy, tax, compliance, or data-processing clause was rewritten.

Legal follow-up recommended: counsel should review the existing refund, governing-law, privacy, tax, and Merchant-of-Record language before broad commercial launch. This audit does not provide legal approval.

## Explicitly outside this change

- No feature development, scoring change, plan change, credit change, referral change, database operation, migration application, Supabase change, Creem change, or payment.
- No UI structure, color, font, grid, card, breakpoint, spacing, animation, theme, header, or footer-layout change.
- Phase C2 did not start. SES remains paused.

## Follow-up implementation review

The current risk-settings and blacklist routes authenticate a user but do not implement the Growth-only plan gate that the old comparison table implied. Those rows were removed rather than changing access control during a copy audit. Before presenting either capability as a paid-plan entitlement, run a separate authorization and tenant-isolation review and then define an explicit entitlement contract.
