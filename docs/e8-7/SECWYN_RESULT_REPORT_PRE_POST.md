# Secwyn E8.7 Result and Report Pre/Post

Date: 2026-07-15

Scope: local E8.7 implementation only

## Before

- The bulk result page exposed a summary and one long result table, but operators could not narrow the table by Send, Review or Suppress queue and could not search within completed results.
- The embedded report was generated from list summary data only. It used readiness, launch and estimated-waste language that was not backed by the contact-level audit evidence.
- The report did not include input reconciliation, complete contact evidence, evidence coverage, canonical audit metadata or an explicit limitations section.
- CSV generation was split across local and shared implementations, and spreadsheet-formula-looking values were not explicitly neutralized.
- XLSX used the result data but did not explicitly neutralize formula-like text.
- The application had no self-contained downloadable HTML report and no dedicated browser print path.
- Single Risk Check mixed evidence with outcome-sounding labels and did not show the audit contract metadata.
- Pre-send detail retrieval did not independently assert campaign ownership before reading campaign results.

## After

- Bulk results retain the existing audit engine and response contract, while adding queue tabs, search and progressive rendering for large runs.
- The report is derived from the actual completed results and reconciliation data. It presents real decision distribution, required actions, top negative drivers, evidence coverage, contact-level evidence, limitations and canonical metadata.
- HTML is self-contained and escaped. Browser Print / Save PDF uses a light, ink-friendly stylesheet. Both operations consume zero additional credits.
- CSV and XLSX retain the existing canonical result fields, use stable Secwyn filenames and neutralize values that spreadsheet software could treat as formulas.
- The risk-summary CSV no longer promotes inferred readiness, savings or waste-prevention figures as audited outcomes.
- Single Risk Check labels domain, mailbox and IP information as evidence rather than proof, and displays audit ID, time, engine, policy and evidence states.
- Pre-send detail retrieval now verifies that the requested campaign belongs to the signed-in user before returning its result rows.

## Deliberately unchanged

- Contact decision thresholds, point values and canonical decision mapping.
- Scan execution, chunking, cache charging, credit deduction and idempotency.
- API and Google Sheets routes, payloads, result columns, limits and entitlements.
- Pricing, plan entitlements, Auth, Creem, referrals, database schema, RLS, SES and E8 feature flags.
- White-label output, invented client/campaign names, outcome guarantees and new readiness formulas were not added.

## Visual evidence

The deterministic fixture images in `docs/e8-7/screenshots/` cover mixed, single-queue, empty, partial, failed-lookup, 500-contact, desktop, mobile and print states. Protected local routes are also captured at their authentication boundary in dark and light themes. No production customer data was used.
