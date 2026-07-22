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
