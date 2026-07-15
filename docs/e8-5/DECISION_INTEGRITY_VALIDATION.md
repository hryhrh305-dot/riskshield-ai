# Secwyn E8.5 Decision Integrity Validation

Date: 2026-07-15

Start commit: `4f8a70e6cdc5689f4d06d28572ad07e845f7ec72`

Final commit: the single commit named `Harden Secwyn decision integrity across audit channels`; its immutable hash is reported by `git rev-parse HEAD` after creation and in the final handoff.

## Files

Shared decision and mapping:

- `src/lib/decision-integrity.ts`
- `src/lib/decision-contract.ts`
- `src/lib/list-audit.ts`
- `src/lib/risk-engine.ts`
- `src/lib/plans.ts`

Active adapters and UI:

- `src/app/api/bulk-check/route.ts`
- `src/app/api/v1/email/batch-check/route.ts`
- `src/app/(dashboard)/bulk-check/page.tsx`
- `src/app/(dashboard)/risk-check/page.tsx`
- `google-sheets-addon/Code.gs`

Tests and evidence:

- `tests/e8-5-decision-integrity.test.ts`
- `tests/e8-6-cross-surface-parity.test.ts`
- `tests/bulk-run-credit-accounting.test.ts`
- `tests/result-visibility.test.mjs`
- `docs/e8-5/DECISION_INTEGRITY_AUDIT.md`
- `docs/e8-5/DECISION_INTEGRITY_PRE_POST.md`
- `docs/e8-5/DECISION_INTEGRITY_VALIDATION.md`
- `docs/e8-5/DECISION_INTEGRITY_ROLLBACK.md`

## Root causes and changes

| Root cause | Minimal correction |
| --- | --- |
| Safe `mailto:` normalization missing | Strip only a leading case-insensitive `mailto:`; preserve plus tags, local-part dots and Unicode boundary behavior. |
| Row evidence incomplete | Add explicit row booleans, rejection reason and final processed/charged reconciliation. |
| Catch-all failure became false | Preserve `yes/no/unknown/not_tested/lookup_failed`; set No only after a completed negative probe. |
| Audit identity/version implicit | Add additive `evidence_state`, `mailbox_status`, `policy_rules_version` and deterministic/fallback `audit_id`. |
| Exports lacked canonical evidence metadata | Add the same status/version/identity columns to the shared CSV/XLSX/Sheets mapping. |
| Configured high-risk path could call a paid model | Keep deterministic local explanation templates and remove the remote completion call path. |
| Unsupported certainty in result wording | Remove “guaranteed bounce” from active decision output and the single-check MX label. |

## Test and build results

| Command | Result |
| --- | --- |
| Baseline `npm test` before edits | PASS: 30 files, 190 tests. |
| E8.5/E8.6/credits/Sheets/bulk targeted suite | PASS: 6 files, 70 tests in the final targeted run. |
| `npm test` after edits | PASS: 30 files, 205 tests. |
| `node --test` auth/auth-email/Creem/result-visibility | PASS: 31 tests. |
| `node --test tests/smtp-classification.test.mjs` | Known runner baseline: cannot resolve the repository `@/` alias under raw Node; the SMTP classifier remains covered through project compilation and unchanged code. |
| `npm run lint` | Known baseline: 111 errors, 40 warnings repository-wide. No lint finding is on a newly added/changed line. Changed-file scan reports 36 errors/6 warnings, all pre-existing `any`, hook or `prefer-const` findings outside the changed hunks. |
| `npx tsc --noEmit` | Known baseline: 129 errors repository-wide; 0 errors in changed files. |
| `npm run build` | PASS: Next.js 16.2.9 production build, 52/52 static pages generated. Type checking is skipped by the existing build configuration. |
| `git diff --check` | PASS before commit. |

## Benchmark

- Fixture SHA-256: `b5e3668d6fcaa0c27e5c36ff81a874564bf959bec29feda93b27b8cf328019fc`.
- Input: 100 rows.
- Syntax accepted: 90; rejected: 10; duplicate: 1; unique processed: 89.
- Deterministic decisions: ALLOW 0, REVIEW 59, BLOCK 30.
- Results with Recommended Action: 89/89.
- Disposable/reserved/provider-typo to ALLOW: 0.
- Actual credits: 0; paid vendor calls: 0.

## Web/API/Sheets parity

- `src/lib/decision-contract.ts` supplies the same canonical fields for `single`, `bulk`, `api`, `google_sheets` and `report_export` surfaces.
- Fixed-snapshot parity tests compare every field in `CANONICAL_DECISION_FIELDS`; mismatch count is 0.
- Web and API batch routes finalize the same row reconciliation helper.
- Sheets continues to call `/api/v1/email/batch-check`, uses server `export_columns`, and maps Catch-all/Mailbox multi-state values without recalculating decisions.
- Existing `risk_score`, `risk_level`, boolean Catch-all and other legacy fields remain additive compatibility aliases.

## Credits validation

- 0/1/3 exact amounts pass the atomic adapter matrix.
- Invalid and duplicate inputs are removed before billable calculation.
- Insufficient credit returns zero deduction.
- Cache lookup remains after atomic credit consumption, so cache hits remain charged.
- Database operation uniqueness and fingerprint conflict checks preserve idempotent replay behavior.
- Reservation finalize/release SQL contracts pass their dedicated tests.
- Browser report view, CSV/XLSX generation and repeated downloads have no credit consumer.

## Local smoke

Production build served at `http://localhost:3105` only for local verification and was stopped afterward.

- 200: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/pricing`, `/docs`, `/docs/google-sheets`, `/api/google-sheets-addon`.
- Protected `/dashboard`, `/bulk-check`, `/risk-check` redirected to `/login?...` and ended at 200.
- Unauthenticated `/admin/e8` returned the intentional concealed 404.
- Unauthenticated POST `/api/bulk-check`, POST `/api/v1/email/batch-check`, POST `/api/create-checkout` and GET `/api/referrals/me` returned 401 without consuming credits or creating payment state.
- Downloaded Apps Script contained the current batch endpoint, 5,000 limit, Catch-all status and Mailbox status mappings.

## Protected behavior proof

- Prices/capacities remain `$49/500`, `$249/2,500`, `$1,499/15,000`; Free remains 50 one-time and Business remains contract-based.
- Risk thresholds and scoring point values were not edited.
- Referral, Creem, Billing, Auth, password reset, E8, SES/SNS and migrations are absent from the diff.
- Paid vendor calls per audit: 0. Paid vendor calls per report: 0.
- No dependency or lockfile change.
- No UI redesign, navigation change, Light Mode or Flowwyn styling.
- No production database, deployment, push, environment or Google Sheets publication action.

## Unverified and known baseline

- No real mailbox, production credit, payment, refund, SES event or published Sheets add-on was exercised.
- Standalone PDF/HTML file export is not part of the current MVP; the current HTML preview and CSV/XLSX exports were validated without expanding into E8.7.
- A process crash after synchronous batch credit consumption cannot be automatically refunded by this database-free patch; this requires a separately authorized credit operation/migration or moving the detailed path onto the existing reservation workflow.
- Full repository lint/typecheck debt remains isolated and was not expanded.

## Completion status

All in-scope code, deterministic policy, cross-surface, export, Credits and local smoke checks are complete. The result is `PASS WITH KNOWN BASELINE` because the repository-wide lint/typecheck baseline and synchronous crash-refund limitation remain explicitly isolated.
