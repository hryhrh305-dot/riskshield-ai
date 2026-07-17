# Secwyn E8.8R Decision Utility Test Matrix

Automated by `tests/e8-8r-pricing-decision-utility.test.ts` and existing E8.5/E8.6 suites.

| Set | Fixture | Expected |
|---|---|---|
| Known-valid provider | Gmail, Outlook, Yahoo, iCloud, Proton | Low score + MX present + mailbox unconfirmed => ALLOW, low confidence |
| Known-valid hosted mail | Google Workspace, Microsoft 365, enterprise MX fixture | Same contract; provider name does not force REVIEW |
| Known-invalid | Disposable, No MX, Null MX, mailbox rejected, reserved/test, provider typo | BLOCK |
| Ambiguous | MX timeout, MX lookup failure, catch-all yes | REVIEW |
| Boundary | 25 / 26 / 65 / 66 | ALLOW / REVIEW / REVIEW / BLOCK |
| Parity | single, bulk, API, Google Sheets, report/export | Same canonical decision, reason and evidence state |

SEND/ALLOW means no current blocking evidence under normal campaign controls. It does not guarantee mailbox existence, delivery or inbox placement.
