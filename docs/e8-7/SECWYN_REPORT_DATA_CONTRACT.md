# Secwyn E8.7 Report Data Contract

## Inputs

The report formatter accepts three existing objects from a completed Web list audit:

- `results`: canonical contact result rows returned by `/api/bulk-check`
- `audit_summary`: existing list summary returned by the same completed run
- `input_reconciliation`: input/accepted/rejected/duplicate/result/Credits accounting from the same run

No network request, database read, risk calculation, credit consumer, LLM or paid vendor call occurs during report generation.

## Canonical contact facts

| Fact | Source | Report use |
|---|---|---|
| Original input / row | `input_reconciliation.rows` matched by normalized email | Contact traceability when available |
| Normalized email | `normalized_email` / compatibility `email` | Contact identity |
| Final Decision | `decision` / `risk_level` | Queue and contact decision |
| Base Signal Score | `risk_score` | Existing score context only |
| Primary reason/code | `primary_reason`, `primary_reason_code` | Explanation and negative-driver aggregation |
| Recommended action | `recommended_action` | Required Actions and contact next step |
| Explanation | `decision_explanation` | Contact context |
| Evidence states | `mx_status`, `mailbox_status`, `catch_all_status` | Coverage and limitation disclosure |
| Classifiers | `disposable`, `role_based` | Existing technical evidence/export |
| Versions | `engine_version`, `policy_rules_version` | Audit reproducibility |
| Identity/time | `audit_id`, `audited_at` | Contact/report metadata |

## Derived presentation facts

- Send/Review/Suppress counts are recomputed by counting the actual report rows so their sum equals the contact rows in the artifact.
- Queue percentages use the actual report-row count as denominator and return 0 for an empty result.
- Required Actions group exact recorded `recommended_action` strings by queue.
- Top Risk Drivers group only non-Send rows with a non-empty, non-`UNKNOWN_RISK` primary reason code.
- Evidence Coverage counts exact state strings; it does not convert unknown/failed/not-tested to No.
- If `audit_summary.total` differs from actual result rows, the report is explicitly marked partial in limitations.
- Multiple contact audit IDs or versions are stated as multiple/mixed; they are not collapsed into a fabricated list-level ID.

## Reconciliation invariants

- `Input rows = syntax accepted + rejected before screening` for a finalized normal run.
- `Syntax accepted = unique processed + duplicates removed` for the current normalized input policy.
- `Send + Review + Suppress = report contact rows`.
- `Results produced = unique processed` for a complete normal run.
- `Credits consumed` is copied from the finalized server reconciliation; report/download code never changes it.

## Cross-format result manifest

`src/lib/audit/result-manifest.ts` keeps result totals separate from the number of detail records included by a specific surface or artifact. Its shared contract records input rows, syntax acceptance, rejected rows, duplicate occurrences, unique processed results, result and credit counts, Send/Review/Suppress counts, total/included detail records, format mode and whether the artifact contains the full detail set.

- Web progressively reveals the filtered canonical result collection and reports `Showing X–Y of N unique results`.
- Downloaded HTML is a full detailed report and includes every canonical result row.
- Print/PDF is an executive summary and includes at most the first 20 canonical results in uploaded order.
- Full CSV and XLSX exports use the complete canonical result collection.
- Send, Review and Suppression queue exports partition that same collection.
- `First source row` is the first accepted position of the normalized address in the uploaded input. It is not a result count and can be non-consecutive after rejection and deduplication.

The locked invariants are:

- `syntaxAccepted - duplicateOccurrences = uniqueProcessed`
- `uniqueProcessed = resultCount`
- `resultCount = creditsConsumed`
- `sendCount + reviewCount + suppressCount = resultCount`

## Artifact safety

- React escapes visible result values.
- Downloadable HTML uses an explicit HTML escape function for every inserted value.
- CSV uses a shared cell sanitizer and quotes all cells.
- Spreadsheet strings whose first meaningful character is `=`, `+`, `-`, or `@` receive a leading apostrophe in the artifact context.
- XLSX uses the same sanitized values before worksheet creation.
- Filenames are fixed Secwyn slugs and do not include user-controlled text.

## Compatibility boundary

- Existing API fields and Google Sheets `export_columns` are not removed or renamed.
- Existing summary readiness/waste compatibility fields remain in the route response, but the E8.7 client report does not present unmeasured savings or a new readiness formula.
- Current plan visibility and Growth+ API/Sheets gates remain unchanged.
