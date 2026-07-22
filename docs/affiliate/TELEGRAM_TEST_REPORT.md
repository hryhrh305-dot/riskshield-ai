# Affiliate Telegram test report

## Verified locally

- Approved and published content is eligible; draft/retired/rolled-back content is rejected.
- Daily and rule content never requires Affiliate identity disclosure.
- Qualified-sale announcements require a qualified sale and explicit membership privacy consent.
- Payout notices require both paid and reconciled evidence.
- The worker claims at most ten eligible rows through `FOR UPDATE SKIP LOCKED` and tags them with a unique worker ID.
- Status updates require both `processing` and the same worker ID.
- A daily publication is unique by channel and India-local date, including unknown delivery outcomes.
- Known failures retry with bounded exponential backoff and reach dead letter after five attempts.
- Unknown delivery is not blindly retried.
- Seven existing channel slots are modeled; the first two retain pinned state and message 11 is marked for approved replacement.

## External status

No real Telegram message was sent. The real channel remains paused and unverified in seed data. Bot token, chat ID, Bot creation, administrator permission, pin synchronization and any real publication remain HumanOps-only and last in the rollout order.

Preview mock-runtime testing remains blocked until the isolated database migration and content seed can run.

