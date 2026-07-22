# Affiliate Telegram test report

## Passed

- Approved/published content gate.
- Qualified-sale and privacy-consent gate.
- Paid plus reconciled Payout Notice gate.
- Atomic `FOR UPDATE SKIP LOCKED` claim.
- 100 workers / 100 unique claims.
- One daily publication per channel and India-local date.
- Bounded retry, dead letter and unknown-delivery handling.
- 24 versioned content records and seven message slots; two seed runs remained idempotent.
- First two existing slots retain pinned state.
- Message 7 remains `Update Required`; no Preview application link was placed in the real-channel record.

## External delivery

Vercel confirms the Bot token and private chat target variables exist as Sensitive values scoped only to the Affiliate Preview branch. The connected tooling deliberately does not reveal their plaintext values, so agent-side external delivery was not attempted by bypassing Vercel secret controls.

Real Telegram sends: 0. Real channel edits/deletes/posts/pins/unpins: 0. The real channel seed record remains paused and unverified. One private-channel synthetic delivery remains an explicit HumanOps gate.

## Operational Private Canary

- A separate synthetic channel record named `preview-private-canary` was created without a public handle and remained paused.
- One pending publication referenced an approved and published synthetic content version.
- The Preview canary endpoint performed the required target verification before calling `sendMessage`.
- Verification returned `target_unverified`; the endpoint failed closed with HTTP 503.
- Publication state remained `pending`, `attempt_count=0`, message reference absent and unknown-delivery false.
- Private Telegram sends: 0. Real Telegram sends: 0. Duplicate sends: 0.
- HumanOps must confirm that the bot can resolve the exact private test target `Secwyn Affiliate Bot Test` before one controlled retry. No retry is authorized by this report.
- The real `india-updates` channel remains unverified and paused with seven seeded slots; its first two pinned states are preserved and message 7 remains a future manual update.
