# Secwyn E8.5 Decision Integrity Benchmark

Date: 2026-07-15

Dataset SHA-256: `b5e3668d6fcaa0c27e5c36ff81a874564bf959bec29feda93b27b8cf328019fc`; package file and `tests/fixtures/secwyn-email-benchmark-100.txt` are byte-identical

Method: deterministic input, hard-override, report, and export-policy benchmark. No production API, database, credits, DNS, SMTP, paid service, or real mailbox was invoked.

## Interpretation boundary

This benchmark verifies policy integrity and reconciliation, not real-world mailbox deliverability. Provider mailbox existence cannot be certified without owned inboxes or observed delivery. For rows that are syntactically valid and have no guaranteed-invalid/disposable/reserved/typo signal, the deterministic fixture supplies `MX present / mailbox unconfirmed`; E8.5 must therefore return REVIEW rather than an unsupported safe claim.

## Before / after

| Metric | Before (`ee06251`) | After E8.5 local patch |
|---|---:|---:|
| Input rows | 100 | 100 |
| Parser-produced valid tokens | 91 | 90 |
| Unique valid addresses processed | 90 | 89 |
| Rejected before screening | 9 explainable; internal-space row was mutated | 10 |
| Duplicates removed | 1 | 1 |
| Results produced by deterministic policy run | Not safely reproducible without the old external DNS/SMTP path | 89 |
| Contract credits consumed | 90 | 89 |
| Actual credits consumed by this benchmark | 0 | 0 |
| ALLOW / REVIEW / BLOCK | Not safely reproducible without external checks | 0 / 60 / 29 |
| Disposable -> ALLOW | Reachable in legacy score path; exact live count not safely measured | 0 |
| Reserved/test domain -> Send | Reachable in legacy score path; exact live count not safely measured | 0 |
| Unsupported `Safe` / `high inbox` / `<5% bounce` claims | Present in legacy default templates | 0 |
| Summary/detail reconciliation gap | Possible because browser summary used legacy `risk_level` | 0 |
| Recommended Action coverage | Not guaranteed by legacy raw result | 100% (89/89) |
| Catch-all unknown | Coerced to No in Web/Sheets | `Unknown` or `Not tested` |
| Export replacement-character sample | `LOW ?normal...` reachable | Sanitized to ASCII ` - ` |
| Deterministic benchmark assertion runtime | Not recorded | 33 ms test body; 919 ms Vitest process |

## Why 100 did not equal the old result count

- Ten rows are malformed and are now rejected as their original rows.
- One of those ten, `space inlocal@example.com`, was previously split on whitespace; the suffix `inlocal@example.com` became a new address that the user never supplied.
- The valid-syntax set contains `first.last@secwyn.com` and `FIRST.LAST@secwyn.com`; the existing normalized-unique billing rule treats them as one address.
- Therefore the canonical reconciliation is: `100 input = 89 unique processed + 10 rejected + 1 duplicate`.

## After-policy distribution

- BLOCK/Suppress: 29
  - 10 known disposable domains
  - 5 IANA example-domain rows
  - 4 accepted `.invalid` rows (the fifth `.invalid` candidate has an invalid leading-hyphen domain label and is rejected before screening)
  - 10 common provider-typo rows with deterministic correction suggestions
- REVIEW: 60
  - Domain-level evidence only; individual mailbox remains unconfirmed
- ALLOW/Send: 0
  - The controlled dataset intentionally contains no owned mailbox-level positive evidence

## Reconciliation assertions

- `inputRows = uniqueProcessed + rejected + duplicates` -> `100 = 89 + 10 + 1`
- `results = uniqueProcessed` -> `89 = 89`
- `summary total = send + review + suppress` -> `89 = 0 + 60 + 29`
- All 89 canonical results have Decision, Primary Reason, Supporting Evidence or limitation, Confidence, and Recommended Action.

## Live verification still required before production

A later explicitly authorized Preview/production smoke should use 5-10 inboxes controlled by the user across major providers and one business domain. That smoke must separately observe real DNS/SMTP outcomes, decision distribution, charged credits, retry idempotency, Web/API/Sheets parity, and exported files. This local benchmark deliberately did not consume credits or touch production.
