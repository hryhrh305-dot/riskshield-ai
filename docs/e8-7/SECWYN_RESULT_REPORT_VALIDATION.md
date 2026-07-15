# Secwyn E8.7 Result and Report Validation

Date: 2026-07-15

Status: PASS WITH KNOWN BASELINE

## Validation scope

This record covers the local E8.7 result experience, client-ready report, export safety, print behavior, parity and protected-boundary checks. It does not authorize or record a production deployment.

## Functional checks

- Canonical ALLOW / REVIEW / BLOCK decisions map only to Send / Review / Suppress presentation queues.
- Summary totals, reconciliation, required actions, drivers and contact rows are derived from the same in-memory result set.
- Unknown, not-tested and failed evidence remain explicit.
- Empty and partial results do not become a positive readiness conclusion.
- HTML escaping and CSV/XLSX formula neutralization are covered by targeted tests.
- Viewing and exporting completed results adds no credit-consuming request.
- API and Google Sheets implementation files remain unchanged.

## Gate results

- `npx vitest run tests/e8-7-result-report.test.ts`: 1 file, 8/8 tests passed.
- `node scripts/test-audit-report-shape.mjs`: passed.
- `node scripts/test-list-audit-csv-export.mjs`: passed.
- `npm test`: 33 files, 225/225 tests passed.
- `npm run build`: passed; Next.js generated 52/52 pages. The repository's existing middleware deprecation warning remains.
- `npx tsc --noEmit --incremental false`: repository baseline remains 129 errors; 0 errors matched E8.7 changed files.
- Targeted ESLint across changed source and test files: the only findings are 20 errors and 3 source warnings in the pre-existing `risk-check/page.tsx` and `api/pre-send/route.ts` baseline, plus one CSS configuration warning. The new report formatter, report component, export helper and E8.7 test add no lint finding.
- `npm run lint`: repository baseline remains 111 errors and 40 warnings; no increase from the approved baseline.
- `git diff --check`: passed with no whitespace error. Git reported only the repository's existing Windows line-ending notices.
- Protected-file diff: no change to risk engine, decision contract, plans, credits, Google Sheets, Supabase migrations, payment routes, Auth routes, referral logic or environment files.
- TODO/placeholder scan: no match in E8.7 changed code, scripts, tests or docs.

## Performance and scale

- The E8.7 unit test creates and formats 5,000 contact rows and requires completion in under 2,000 ms; the test passed.
- A 500-contact real report artifact was rendered and captured through the production report builder.
- The on-page bulk result workbench renders 250 rows initially and can progressively reveal more, while downloads retain all completed result rows.

## Claim scan

- E8.7 report and export surfaces contain no Campaign Readiness Score, invented launch decision, potential savings, waste-prevention outcome, guaranteed delivery/inbox, fictional client or fictional campaign claim.
- A repository-wide active-runtime scan finds one pre-existing `Campaign Readiness Score` plan label on `/pricing`. E8.7 does not use that value in its report, does not invent a new formula and leaves the approved E8.6 pricing surface unchanged.
- No AI model, paid enrichment provider or external PDF vendor was added.

## Browser evidence

`scripts/e8-7-browser-validation.mjs` generated the screenshot set documented in `SECWYN_PRINT_PDF_VALIDATION.md`. Fixture report pages had no horizontal document overflow at the tested desktop and mobile viewports. Protected local routes redirected to the local sign-in page as expected. `/`, `/pricing`, `/docs`, `/docs/google-sheets` and `/login` each returned HTTP 200 with no page error or document overflow.

## Production boundary

- No push
- No deploy
- No migration or database action
- No environment, payment, Auth, referral, SES or E8 flag change
- No production customer account or customer data used
