# Secwyn E8.7 Result and Report Rollback

Date: 2026-07-15

## Scope

E8.7 is an additive local application/report change. It introduces no database migration, persisted report record, new environment variable, external service or production configuration.

## Normal rollback

1. Identify the independent commit named `Upgrade Secwyn results and client-ready audit reports`.
2. Revert that commit with a normal forward revert; do not reset shared history.
3. Run the targeted E8.7 tests, the full Vitest suite and the production build.
4. If a future authorized deployment contains E8.7, deploy the verified revert commit through the normal Secwyn release path.

## Partial rollback boundaries

- Result/report UI, HTML generation and print CSS can be reverted together without changing the contact risk engine.
- CSV/XLSX neutralization should normally be retained because it is a safety control. If UI rollback is required, review that safety change separately rather than removing it automatically.
- The pre-send ownership guard is security hardening and should normally be retained. Roll it back only if a verified compatibility issue exists and an equivalent ownership control is present.

## Data and credit impact

- No data rollback is needed.
- No credit reconciliation is needed because report view, HTML, print, CSV and XLSX operations consume zero additional credits.
- Existing scans, audit history, API consumers and Google Sheets results remain compatible.

## Post-rollback verification

- Confirm risk thresholds remain 0–25 ALLOW, 26–65 REVIEW and 66–100 BLOCK.
- Confirm `/api/v1/email/check`, `/api/v1/email/batch-check`, `/api/bulk-check` and Google Sheets contracts still pass parity tests.
- Confirm cache hits remain charged and idempotent retries do not double-charge.
- Confirm Auth, Creem, plans, referral, SES and E8 flags are unchanged.
