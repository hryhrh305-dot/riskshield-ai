# Secwyn E8.7 Result and Report Risk Notes

Date: 2026-07-15

## P0 findings before implementation

1. **Report truth boundary** — the current `AuditReportPreview` receives only `ListAuditSummary`. It cannot prove input reconciliation, contact-level evidence, canonical versions or audit time, yet it displays fictional default client and campaign values. E8.7 must use actual run data and omit unavailable identities.
2. **Unverified value estimates** — the active report and risk-summary CSV display calculated “waste prevented,” assumed review time and USD value. These are not measured customer outcomes. Compatibility fields can remain in existing API objects, but the E8.7 client report must not present them as achieved value.
3. **List-level inference** — a readiness score and launch-status formula exist and have tests, but they are not part of the canonical contact decision contract. E8.7 will not create another list rule. The safest default report hierarchy is real distribution, reconciliation, required actions and evidence limitations.
4. **Cross-export drift** — the page has a hand-built CSV path and a shared CSV helper. Queue CSV, full CSV, XLSX, Sheets and API can therefore format the same value differently.
5. **Spreadsheet injection** — arbitrary returned or user-controlled text is quoted but not neutralized when it starts with a spreadsheet formula marker. CSV/XLSX output needs a shared context-safe conversion without changing risk-engine input or normalized email semantics.
6. **Generated HTML safety** — React escapes the current on-screen preview, but a new downloadable HTML report must explicitly escape every inserted string and use a safe fixed filename.
7. **Audit-history ownership** — `/api/pre-send?campaign_id=` queries contact results by campaign ID after authenticating a user but does not first prove the campaign belongs to that user. The minimal fix is an ownership lookup; no schema/RLS change is authorized.
8. **Partial-run truth** — the current Web batching helper aborts when a request fails and does not persist resumable partial report state. E8.7 must label failure honestly and must not claim resume, completion or a client-ready report for an incomplete run.
9. **Credits separation** — report view and client-side exports currently call no credit consumer. Any new HTML or print action must remain a pure client operation. Cache hits remain charged for the underlying audit.
10. **Legacy history limits** — saved `pre_send_*` records expose only old campaign counts and narrow contact fields. E8.7 must not invent audit ID, engine version, action, reviewer, client or campaign metadata for old rows.

## Protected invariants

- No risk point, 0–25/26–65/66–100 boundary, hard override or canonical contact decision changes.
- No API or Sheets breaking change and no removal of existing export fields.
- No Credits, grant ledger, cache-charging, request-idempotency or plan-gate change.
- No database migration, RLS rewrite, Creem, Auth, Referral, SES, E8 flags, environment, dependency or production operation.
- Current prices and capacities stay $49/500, $249/2,500 and $1,499/15,000; future E8.8 values must not appear as live.
- Dark remains the default and the E8.6 light theme/layout remains intact.

## Safe implementation boundary

- Derive report sections from the existing `results`, `audit_summary` and `input_reconciliation` already returned by the Web route.
- Add pure formatting, escaping, action aggregation, evidence-coverage and artifact-building helpers with tests.
- Add presentation-only filtering/search and report print/download actions.
- Add an authenticated ownership check to the existing history API query.
- Treat browser print as the PDF path; do not add a PDF service, report API, LLM or paid vendor call.

## Rollback trigger

Rollback the E8.7 commit if any test or smoke check shows a changed canonical decision, score, threshold, API/Sheets field, Credits consumption, plan gate, Auth behavior, export row count, or cross-tenant history access. A report-only rendering fault can also be rolled back through the same single commit because E8.7 introduces no migration or persistent report data.
