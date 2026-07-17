# Secwyn E8.8R Decision Utility Root Cause

Status: root cause confirmed and minimally corrected locally on 2026-07-17.

## Exact cause

`src/lib/decision-integrity.ts::applyDecisionIntegrity` treated any missing direct SMTP mailbox confirmation as a decision override. A result with:

- Base Signal Score 0–25;
- MX present;
- no Disposable/Null MX/No MX/reserved/typo/rejection signal; and
- mailbox status `unconfirmed` because the recipient server did not provide SMTP confirmation

was changed from ALLOW to REVIEW with `MAILBOX_UNCONFIRMED`. This shared function feeds the risk engine, single check, bulk check, API, Google Sheets adapter and reports, so the override systematically inflated REVIEW across channels.

## Minimal correction

Mailbox confirmation uncertainty now lowers Confidence and preserves explicit limitations, but does not by itself replace the score-based Decision. True ambiguous or invalid evidence retains its existing override:

- MX lookup failure/timeout: REVIEW;
- catch-all yes: REVIEW;
- missing/not-tested MX evidence: REVIEW;
- Disposable, reserved/test domain, provider typo, Null MX, No MX or mailbox rejection: BLOCK;
- Base score boundaries remain ALLOW 0–25, REVIEW 26–65, BLOCK 66–100.

No scoring point, signal weight, Base Signal Score calculation or threshold changed.
