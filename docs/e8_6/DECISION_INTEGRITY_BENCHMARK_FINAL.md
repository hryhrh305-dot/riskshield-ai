# Secwyn E8.6 Decision Integrity Benchmark Final

Date: 2026-07-15
Fixture: `tests/fixtures/secwyn-email-benchmark-100.txt`
SHA-256: `b5e3668d6fcaa0c27e5c36ff81a874564bf959bec29feda93b27b8cf328019fc`

## Input reconciliation

| Metric | Result |
| --- | ---: |
| Input rows | 100 |
| Unique valid addresses processed | 89 |
| Rejected before screening | 10 |
| Normalized duplicate removed | 1 |
| Results produced | 89 |
| Production credits consumed | 0 |

## Deterministic local signal-snapshot result

| Final Decision | Count |
| --- | ---: |
| ALLOW / Send | 0 |
| REVIEW | 59 |
| BLOCK / Suppress | 30 |

This is the deterministic local parity fixture, not a claim of live mailbox accuracy. The previously recorded live E8.5 distribution used real production network signals and was 0 Send / 50 Review / 39 Suppress. E8.6 intentionally did not rerun 100 contacts in production because the release contract forbids consuming real credits for this smoke.

Compared with the previous deterministic E8.5 fixture result (0 / 60 / 29), exactly one result changed: `secwyn.test.049@tempmail.com` moved from REVIEW to SUPPRESS because `tempmail.com` is now included in the trusted disposable-domain source. No result moved to ALLOW.

## Integrity assertions

- Disposable to Send: 0
- Reserved/test domain to Send: 0
- Provider typo to Send: 0
- Unsupported Safe/high-inbox/<5%-bounce claims: 0
- Recommended Action coverage: 89/89
- Summary/detail reconciliation: 89 = 0 + 59 + 30
- Primary Decision Driver reconciliation: driver counts sum to 89
- Invalid syntax is rejected before billing
- Normalized duplicates are removed before billing
- Cached legacy ALLOW rows are re-evaluated through the canonical decision contract
- Actual production credits consumed: 0

## Cross-surface fixture coverage

The E8.6 parity suite covers normal-domain mailbox-unconfirmed, disposable, reserved domain, `.invalid`, provider typo, No MX, Null MX, DNS lookup failure, role-based, plus-tag role-based, catch-all unknown, cached legacy ALLOW override, confirmed mailbox positive, invalid syntax, and normalized duplicate inputs.

For the same fixed signal snapshot, Single, Bulk, API, Google Sheets response mapping, and report/export adapters match on all canonical contract fields. Surface-specific presentation fields may remain additive.

## Interpretation limit

The benchmark proves deterministic policy consistency and input accounting. It does not certify external deliverability, mailbox existence for unconfirmed addresses, guaranteed inbox placement, a universal bounce-rate threshold, or E8 SES production acceptance.
