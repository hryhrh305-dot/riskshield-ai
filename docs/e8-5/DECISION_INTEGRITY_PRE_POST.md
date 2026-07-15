# Secwyn E8.5 Decision Integrity PRE/POST

Date: 2026-07-15

Fixture: `tests/fixtures/secwyn-email-benchmark-100.txt`

SHA-256: `b5e3668d6fcaa0c27e5c36ff81a874564bf959bec29feda93b27b8cf328019fc`

## Interpretation

The fixture is the byte-identical 100-row deterministic benchmark already stored in the repository. It is not a mailbox-accuracy certificate. No production API, DNS, SMTP, database, credits or paid vendor was used.

The original PRE mailbox decisions were not stored as a reproducible signal snapshot, so the table does not invent them. PRE records only the reproducible parser/billing state. POST uses fixed policy evidence: known disposable/reserved/typo/`.invalid` rows are BLOCK; all other accepted rows have MX present and mailbox unconfirmed and are REVIEW.

## Aggregate diff

| Metric | PRE reproducible state | POST |
| --- | ---: | ---: |
| Input rows | 100 | 100 |
| Syntax accepted (duplicates included) | 91 | 90 |
| Unique processed | 90 | 89 |
| Rejected before screening | 9 | 10 |
| Duplicates removed | 1 | 1 |
| Contract credits | 90 | 89 |
| Actual credits used | 0 | 0 |
| ALLOW / REVIEW / BLOCK | Not reproducible | 0 / 59 / 30 |
| Results with action | Not reproducible | 89 / 89 |
| Cross-surface mismatch | Not measured | 0 |

## Per-row diff

`PRE accepted` means the old parser produced that address; it is not a claim about the old final decision. `POST charged=1` is the contract value for a new audit request; this local run charged 0 actual credits.

| Row | Original input | PRE parser state | POST normalized/state | POST decision / reason / action | Contract credit |
| ---: | --- | --- | --- | --- | ---: |
| 1-10 | Free-mailbox benchmark rows | Accepted | Same / processed | REVIEW / Mailbox unconfirmed / Review identity | 10 |
| 11-40 | Secwyn, SES simulator, role and catch-all-pattern rows | Accepted | Same / processed | REVIEW / Mailbox unconfirmed / Review identity | 30 |
| 41 | `secwyn.test.041@mailinator.com` | Accepted | Same / processed | BLOCK / Disposable mailbox / Suppress | 1 |
| 42 | `secwyn.test.042@yopmail.com` | Accepted | Same / processed | BLOCK / Disposable mailbox / Suppress | 1 |
| 43 | `secwyn.test.043@guerrillamail.com` | Accepted | Same / processed | BLOCK / Disposable mailbox / Suppress | 1 |
| 44 | `secwyn.test.044@maildrop.cc` | Accepted | Same / processed | BLOCK / Disposable mailbox / Suppress | 1 |
| 45 | `secwyn.test.045@getnada.com` | Accepted | Same / processed | BLOCK / Disposable mailbox / Suppress | 1 |
| 46 | `secwyn.test.046@trashmail.com` | Accepted | Same / processed | BLOCK / Disposable mailbox / Suppress | 1 |
| 47 | `secwyn.test.047@fakeinbox.com` | Accepted | Same / processed | BLOCK / Disposable mailbox / Suppress | 1 |
| 48 | `secwyn.test.048@moakt.com` | Accepted | Same / processed | BLOCK / Disposable mailbox / Suppress | 1 |
| 49 | `secwyn.test.049@tempmail.com` | Accepted | Same / processed | BLOCK / Disposable mailbox / Suppress | 1 |
| 50 | `secwyn.test.050@10minutemail.com` | Accepted | Same / processed | BLOCK / Disposable mailbox / Suppress | 1 |
| 51-55 | `example.com/.net/.org` rows | Accepted | Same / processed | BLOCK / Reserved or test domain / Replace contact | 5 |
| 56-60 | `.invalid` rows | Accepted | Same / processed | BLOCK / Reserved or test domain / Replace contact | 5 |
| 61 | `missing-at-symbol.example.com` | Rejected | Rejected / INVALID_EMAIL_SYNTAX | No screening result | 0 |
| 62 | `double@@example.com` | Rejected | Rejected / INVALID_EMAIL_SYNTAX | No screening result | 0 |
| 63 | `space inlocal@example.com` | Mutated to `inlocal@example.com` | Rejected / INVALID_EMAIL_SYNTAX | No screening result | 0 |
| 64 | `.leadingdot@example.com` | Rejected | Rejected / INVALID_EMAIL_SYNTAX | No screening result | 0 |
| 65 | `trailingdot.@example.com` | Rejected | Rejected / INVALID_EMAIL_SYNTAX | No screening result | 0 |
| 66 | `double..dot@example.com` | Rejected | Rejected / INVALID_EMAIL_SYNTAX | No screening result | 0 |
| 67 | `missing-domain@` | Rejected | Rejected / INVALID_EMAIL_SYNTAX | No screening result | 0 |
| 68 | `@missing-local.example.com` | Rejected | Rejected / INVALID_EMAIL_SYNTAX | No screening result | 0 |
| 69 | `user@-leadinghyphen.invalid` | Rejected | Rejected / INVALID_EMAIL_SYNTAX | No screening result | 0 |
| 70 | `user@domain..invalid` | Rejected | Rejected / INVALID_EMAIL_SYNTAX | No screening result | 0 |
| 71 | `secwyn.typo.071@gmial.com` | Accepted | Same / processed | BLOCK / Possible domain typo / Correct to gmail.com | 1 |
| 72 | `secwyn.typo.072@gamil.com` | Accepted | Same / processed | BLOCK / Possible domain typo / Correct to gmail.com | 1 |
| 73 | `secwyn.typo.073@gmai.com` | Accepted | Same / processed | BLOCK / Possible domain typo / Correct to gmail.com | 1 |
| 74 | `secwyn.typo.074@outlok.com` | Accepted | Same / processed | BLOCK / Possible domain typo / Correct to outlook.com | 1 |
| 75 | `secwyn.typo.075@outllook.com` | Accepted | Same / processed | BLOCK / Possible domain typo / Correct to outlook.com | 1 |
| 76 | `secwyn.typo.076@hotnail.com` | Accepted | Same / processed | BLOCK / Possible domain typo / Correct to hotmail.com | 1 |
| 77 | `secwyn.typo.077@yaho.com` | Accepted | Same / processed | BLOCK / Possible domain typo / Correct to yahoo.com | 1 |
| 78 | `secwyn.typo.078@icloud.co` | Accepted | Same / processed | BLOCK / Possible domain typo / Correct to icloud.com | 1 |
| 79 | `secwyn.typo.079@protonmail.co` | Accepted | Same / processed | BLOCK / Possible domain typo / Correct to protonmail.com | 1 |
| 80 | `secwyn.typo.080@fastmai.com` | Accepted | Same / processed | BLOCK / Possible domain typo / Correct to fastmail.com | 1 |
| 81-90 | Unicode and punycode boundary rows | Accepted | Same / processed | REVIEW / Mailbox unconfirmed / Review identity | 10 |
| 91-93 | Plus-tag and dotted-local rows | Accepted | Same / processed | REVIEW / Mailbox unconfirmed / Review identity | 3 |
| 94 | `FIRST.LAST@secwyn.com` | Duplicate | `first.last@secwyn.com` / duplicate | No second screening result | 0 |
| 95-100 | Remaining valid local-part boundary rows | Accepted | Lowercased / processed | REVIEW / Mailbox unconfirmed / Review identity | 6 |

## POST integrity assertions

- `100 input = 90 syntax accepted + 10 rejected`.
- `90 syntax accepted = 89 normalized unique + 1 duplicate`.
- `89 results = 0 ALLOW + 59 REVIEW + 30 BLOCK`.
- Disposable to ALLOW: 0.
- Reserved/No MX/Null MX hard-override tests to ALLOW: 0.
- Recommended Action coverage: 89/89.
- Web/API/Sheets/report-export mismatch on canonical fields: 0.
- Actual production credits and paid vendor calls: 0.
