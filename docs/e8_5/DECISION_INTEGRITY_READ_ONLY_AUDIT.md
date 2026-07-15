# Secwyn E8.5 Decision Integrity Read-only Audit

Date: 2026-07-15

Source of Truth: `Secwyn_Project_Blueprint_v1.4.4_PRODUCTION_STABILITY_DECISION_INTEGRITY_ALIGNMENT_2026-07-15.html`

Baseline commit: `ee0625175107dd76b892c4c52a3a750154ff156e`

## 1. Current data flow

### Web list audit

1. Paste input is parsed by `extractWebBulkEmails`; file input is parsed by `readWebBulkFileEmails`.
2. Both paths return only normalized valid strings. Original row/value, rejected rows, and duplicate rows are discarded before the request.
3. The page splits accepted addresses into batches of 100 and sends each batch to `/api/bulk-check` with an idempotency key.
4. The route normalizes and de-duplicates again, consumes one server-side credit for each unique valid address, reads cached results when available, and runs `calculateRiskScore` for uncached results.
5. `attachAuditFields` derives the report decision. The page merges batch responses and rebuilds summary counts.
6. CSV/XLSX exports are generated in the browser from the merged rows.

### API and Google Sheets

1. Google Sheets reads cells, lowercases valid addresses, rejects malformed cells locally, and sends batches of 100 to `/api/v1/email/batch-check` with `x-api-key` and an idempotency key.
2. The API route normalizes and de-duplicates again, charges unique valid addresses through the existing atomic credit path, and returns plan-filtered result rows.
3. Apps Script writes response rows beside source cells and creates the completion summary.
4. The API currently returns results for accepted unique addresses only; it does not expose a complete original-row reconciliation object.

### Canonical signal and decision path

1. `calculateRiskScore` produces the legacy score, decision, evidence-like strings, recommendation, impact, and technical details.
2. `buildContactAuditDecision` converts those fields into Send / Review / Suppress report queues.
3. Page summaries, queue exports, risk summary, and report preview aggregate the attached audit fields.
4. Cached rows travel through the same audit attachment, but the current adapter trusts a legacy ALLOW decision and has no defensive hard-override layer.

## 2. Root cause to symptom mapping

| Symptom | Root cause |
|---|---|
| `space inlocal@example.com` becomes a different accepted email | Web paste parsing splits on all whitespace before syntax validation, so `inlocal@example.com` survives as a new token. |
| 100 source rows cannot be reconciled to result rows | Original row/value, rejects, and duplicates are discarded before the Web request; API responses lack a complete reconciliation block. |
| Disposable or reserved addresses can inherit ALLOW | Final report adapter trusts the legacy score/decision and has no hard-override precedence. Disposable adds only a score contribution that can be offset by positive deductions. |
| Null MX is not distinct from usable MX absence | MX result is represented by booleans only; a `.` target and DNS transport failures are not separately encoded. |
| DNS failure is shown as missing/no mail server | `checkMXRecord` converts all resolver failures after retries into `hasMX=false, mxChecked=true`. |
| Unconfirmed mailbox is shown as safe/high inbox/<5% bounce | Deliverability fields default to optimistic values when SMTP mailbox evidence is absent. |
| Recipient SPF/DKIM/DMARC drives outbound advice | Recipient-domain posture contributes to legacy score and generates sender-facing spam/authentication claims. |
| Catch-all unknown becomes No | Plan sanitation, Web exports, and Apps Script coerce an absent value with boolean truthiness. |
| Top risk reasons contain generic noise | The audit adapter adds `UNKNOWN_RISK`, a queue hint, and positive technical signals even when they did not determine the final decision. |
| Business sees an upgrade CTA for owned features | Bulk report CTA is static and does not depend on the current plan. |
| Export strings contain `?` replacement characters | Legacy rule templates contain damaged punctuation and are exported unchanged. |

## 3. Approved minimal file allowlist

Production code:

- `src/lib/decision-integrity.ts` (new pure hard-override and status helpers)
- `src/lib/risk-engine.ts`
- `src/lib/list-audit.ts`
- `src/lib/bulk-web-batching.ts`
- `src/lib/plans.ts`
- `src/app/(dashboard)/bulk-check/page.tsx`
- `src/app/(dashboard)/risk-check/page.tsx`
- `src/app/(dashboard)/pricing/page.tsx`
- `src/app/api/web-risk/route.ts`
- `src/components/audit/AuditReportPreview.tsx`
- `src/app/api/bulk-check/route.ts`
- `src/app/api/v1/email/batch-check/route.ts`
- `google-sheets-addon/Code.gs`

Tests and evidence:

- `tests/e8-5-decision-integrity.test.ts` (new)
- `tests/bulk-run-web-batching.test.ts`
- `tests/google-sheets-bulk-run-contract.test.ts`
- `tests/fixtures/secwyn-email-benchmark-100.txt`
- `docs/e8_5/DECISION_INTEGRITY_READ_ONLY_AUDIT.md`
- `docs/e8_5/DECISION_INTEGRITY_BENCHMARK_BEFORE_AFTER.md` (new)

Files will be removed from this allowlist if implementation proves unnecessary.

## 4. Explicitly excluded systems

- Database schema, migrations, RLS, RPCs, credit ledger, grants, reservations, and credit-cycle logic
- Creem products, checkout, payment webhooks, customer portal, and payment secrets
- Auth, password reset, signup, referral rewards, E8 flags, AWS SES/SNS, environment variables
- Dependencies, lockfile, global design system, scoring thresholds, DNS cache TTL
- Production deployment, Google Sheets publication, push, or remote branch operations

## 5. Compatibility risks and controls

- Public API: legacy fields remain; new reconciliation/status/explanation fields are additive.
- Scores: public boundaries remain unchanged. Hard overrides may intentionally supersede the score for the final decision.
- Cached results: defensive audit overrides must also apply to cached legacy rows.
- Credits: parsing and reconciliation must not call or modify credit accounting; accepted unique addresses remain the billable unit and cache hits remain charged.
- Sheets: existing `x-api-key`, 100-address internal batch contract, 5,000 user-run limit, and idempotency headers remain unchanged.
- UI: only labels, plan-aware CTA, priority columns, and technical unknown-state rendering may change; layout system and visual theme remain frozen.

## 6. Rollback

The task is database-free. Rollback is a single code change reversal to baseline commit `ee06251`; no SQL, data backfill, credit repair, payment rollback, or environment rollback is required. Before any later production release, preserve the current READY deployment and compare decision distribution, credits, API/Sheets compatibility, and UI smoke results.

## 7. Stop-gate assessment

No required fix needs a database migration, credit/RPC change, payment/Auth/Referral/Webhook/RLS change, API breaking removal, external service, environment change, or production action. Local implementation may proceed within the allowlist. Push, deployment, Google Sheets publication, and production operations still require separate user approval.
