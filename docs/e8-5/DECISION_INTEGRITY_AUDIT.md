# Secwyn E8.5 Decision Integrity Audit

Date: 2026-07-15

Repository: `D:/ai-saas-mvp`

Baseline commit: `4f8a70e6cdc5689f4d06d28572ad07e845f7ec72`

Source of Truth: `Secwyn_Project_Blueprint_v1.5.1_PREMIUM_LIMITED_CAPACITY_ZERO_COST_MINIMAL_CHANGE_2026-07-15.html`

## Scope decision

This is a local, database-free, zero-paid-call safety patch. The repository already contained the E8.5/E8.6 canonical decision layer, so the approved implementation is additive hardening rather than a rewrite. No production action is part of this task.

The v1.5.1 blueprint contains future pricing and capacity targets. Current production behavior remains authoritative for this patch: Free 50 one-time, Starter 500/month, Growth 2,500/month, Scale 15,000/month, Business contract capacity, 5,000 contacts per user bulk run, and decision thresholds 0-25/26-65/66-100.

## End-to-end source map

| Area | Current source of truth | Audit result |
| --- | --- | --- |
| Single Web input and output | `src/app/(dashboard)/risk-check/page.tsx`, `src/app/api/web-risk/route.ts` | Session-authenticated server check, atomic credit consumer, canonical result adapter. |
| Pasted bulk input | `splitScreeningTextRows` -> `reconcileInputRows` in `src/lib/decision-integrity.ts` | One logical row per line/cell; ordinary spaces are not address delimiters. |
| CSV/TXT/XLS/XLSX | `src/lib/bulk-web-batching.ts`, server parser in `/api/bulk-check` | Browser and server both enforce valid normalized unique input; static browser XLSX import is preserved. |
| Bulk Web API | `src/app/api/bulk-check/route.ts` | Starter+ gate before credits; 100-contact internal requests; canonical result adapter. |
| Public API and Sheets | `src/app/api/v1/email/check/route.ts`, `src/app/api/v1/email/batch-check/route.ts`, `google-sheets-addon/Code.gs` | Growth+ gate; Sheets calls the batch route with `x-api-key`; no client-side decision engine. |
| Normalization and reconciliation | `src/lib/decision-integrity.ts` | Original value, normalized value, row, accepted/rejected/duplicate/processed/charged and rejection reason are retained. |
| Scoring and signals | `src/lib/risk-engine.ts` | Existing point values and thresholds retained. Recipient SPF/DKIM/DMARC adjustments are neutralized before final contact decision. |
| Hard overrides and explanations | `src/lib/decision-integrity.ts`, `src/lib/list-audit.ts` | Disposable, reserved/test, No MX, Null MX, provider typo and mailbox evidence use one precedence layer. |
| Canonical DTO | `src/lib/decision-contract.ts` | Shared by Single, Bulk, API, Sheets response and report/export adapters. |
| Summary/report | `src/lib/list-audit.ts`, `src/lib/audit/report-format.ts`, `src/components/audit/AuditReportPreview.tsx` | Top Decision Drivers count one canonical primary reason per result; positive evidence is not a risk reason. |
| CSV/XLSX/Sheets mapping | `src/lib/plans.ts`, bulk page, API batch routes, `Code.gs` | Additive evidence state, engine/policy version, audit ID and timestamp columns. |
| Credits | `src/lib/credit-accounting.ts`, `src/lib/legacy-credits.ts`, `consume_grant_credits` RPC | Unique valid normalized contacts are billable; invalid/blank/duplicate rows are not; cache hits remain billable; idempotent replay returns the recorded operation. |
| Reservation/finalize/release | `supabase/migrations/202607130005_credit_grant_ledger.sql`, `src/lib/bulk-runs/*` | Atomic reservation path has finalize/release contracts and immutable usage tests. Detailed synchronous Web/Sheets routes still consume before processing; see known baseline. |
| Plan and Business CTA | `src/lib/plans.ts`, `src/lib/plan-entitlements.ts`, `getPlanAuditCta` | Current capacities/gates retained; Business CTA is “Run another audit.” |
| Mobile hierarchy | current bulk and single pages | Email, Final Decision, Primary Reason and Recommended Action remain priority fields; technical fields stay secondary. No layout redesign. |

## Findings and root causes

1. `normalizeScreeningEmail` did not implement the explicitly safe `mailto:` removal even though the policy allowed it.
2. Reconciliation exposed aggregate counts but row objects did not explicitly carry accepted/rejected/duplicate/processed/charged or rejection reason.
3. Catch-all probing could set `isCatchAll=false` when SMTP probing was not actually completed, turning lookup failure into No.
4. Canonical rows had engine/snapshot timestamps but no explicit policy/rules alias, audit ID or combined evidence state.
5. Export columns did not carry the evidence and audit identity already present in the canonical response.
6. A legacy high-risk explanation fallback could call DeepSeek when configured. This violated the v1.5.1 zero-paid-call rule even though deterministic templates existed.
7. The single-check MX label and a few legacy templates used unsupported “guaranteed bounce” certainty.

## Minimal implementation allowlist

- `src/lib/decision-integrity.ts`
- `src/lib/decision-contract.ts`
- `src/lib/list-audit.ts`
- `src/lib/risk-engine.ts`
- `src/lib/plans.ts`
- `src/app/api/bulk-check/route.ts`
- `src/app/api/v1/email/batch-check/route.ts`
- `src/app/(dashboard)/bulk-check/page.tsx`
- `src/app/(dashboard)/risk-check/page.tsx`
- `google-sheets-addon/Code.gs`
- `tests/e8-5-decision-integrity.test.ts`
- `tests/e8-6-cross-surface-parity.test.ts`
- `tests/bulk-run-credit-accounting.test.ts`
- `tests/result-visibility.test.mjs`
- `docs/e8-5/*`

## Explicitly forbidden and unchanged

- Pricing, current plan capacities, Free 50, Business contract rules
- Risk points and 0-25/26-65/66-100 thresholds
- Referral 10%, 30-day review and 60-day expiry behavior
- Creem products, checkout, webhooks, Billing, Auth and password reset
- Database schema, migrations, RLS, RPC definitions and production data
- E8 external events, SES/SNS, flags, environment variables, DNS and Vercel
- Google Sheets architecture, 100-contact internal batch, 5,000 user-run limit
- Dark UI design system, navigation, Dashboard and report skeleton
- Dependencies, lockfile, E8.6/E8.7/E8.8 and Light Mode

## Credits reconciliation result

- Invalid syntax, blank and non-email rows: 0 credits.
- Same-request normalized duplicates: 0 additional credits.
- Unique valid address: 1 credit.
- Cache hit: still 1 credit because consumption occurs before cache lookup.
- Same idempotency key + same fingerprint: database returns the original operation; no second usage row.
- Same key + different fingerprint: fails with `IDEMPOTENCY_CONFLICT`.
- Report view, browser CSV/XLSX generation and repeated download: no credit consumer is called.
- The grant ledger remains the authoritative ledger; no new direct profile balance mutation was added.

## Known baseline boundaries

- The deterministic benchmark proves policy/reconciliation, not real mailbox accuracy.
- No standalone PDF or HTML file exporter exists in the current MVP. The existing HTML report preview and CSV/XLSX downloads were audited; E8.5 does not create the E8.7 client-report product.
- The active detailed synchronous batch routes consume atomically before screening. Expected DNS/SMTP failures are converted to evidence states inside the engine, and the separate bulk-run reservation RPC has finalize/release coverage. A process-level crash after synchronous consumption cannot be refunded without a separately authorized credit-operation design/migration; this task does not add one.
- Google Sheets source is locally verified but not published in this task.
