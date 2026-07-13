# Secwyn Subscription Credit Cycles and Referral Rewards Design

Date: 2026-07-13  
Status: Approved design, pending implementation plan  
Product: Secwyn  
Repository: `D:/ai-saas-mvp`

## 1. Objective

Make Secwyn credit issuance and consumption consistent across monthly subscriptions, annual subscriptions, referral rewards, Web checks, API checks, Google Sheets, and resumable bulk runs.

The design must guarantee that:

- subscription credits refresh monthly from the actual purchase date;
- annual subscriptions receive the same monthly allowance cadence as monthly subscriptions;
- unused subscription credits do not roll over;
- referral rewards remain separate from subscription credits and expire 60 days after issuance;
- referral rewards equal 10% of the referred user's first paid plan included checks;
- retries, duplicate webhooks, concurrent requests, and bulk-run refunds cannot duplicate credits;
- existing API and Google Sheets response contracts remain compatible;
- Business plan credits remain contract-defined rather than derived from the test account allowance.

## 2. Canonical Credit Amounts

| Plan | Subscription credits per monthly cycle | Referral reward |
|---|---:|---:|
| Free | 50 | Not eligible |
| Starter | 500 | 50 |
| Growth | 2,500 | 250 |
| Scale | 15,000 | 1,500 |
| Business | Contract-defined | Manual review |

The canonical source for Starter, Growth, and Scale referral rewards is 10% of the plan's included monthly credits. Values are rounded down to a whole credit. Business rewards are never calculated from the internal 100,000-credit test account.

## 3. Billing Cycle Rules

### 3.1 Cycle anchor

The first successful purchase timestamp establishes the paid monthly credit-cycle anchor in UTC. Account registration time and calendar-month boundaries do not affect a paid-plan anchor. Free accounts use their account-creation timestamp as the monthly anchor so the advertised 50 credits per month also has a deterministic refresh rule.

Example:

- registration: August 1;
- purchase: August 15;
- first credit cycle: August 15 through September 15;
- second credit cycle: September 15 through October 15.

### 3.2 Monthly subscriptions

- The first successful payment creates the first subscription grant.
- Each successful monthly renewal confirms the next monthly grant.
- A daily reconciliation job may create a missing grant only when the provider subscription is active and its paid period covers the target cycle.
- Duplicate payment events and retries replay the existing grant through a unique cycle key.

### 3.3 Annual subscriptions

- The annual payment establishes a one-year paid subscription period.
- Credits are not granted for the full year at once.
- One monthly subscription grant is created at each monthly anchor while the annual subscription remains active and the anchor falls inside the paid annual period.
- The same allowance is issued for monthly and annual billing intervals; annual billing changes price cadence, not monthly usage capacity.

### 3.4 End-of-month anchors

For purchases on the 29th, 30th, or 31st, a month without that date uses its final calendar day. Later months return to the original anchor day when available.

Example: January 31 produces February 28/29, March 31, April 30, and May 31 boundaries.

### 3.5 Plan changes and billing failures

- Upgrade: take effect at the provider-confirmed upgrade timestamp, revoke the unused remainder of the old subscription grant, issue one full new-plan monthly grant, and use the provider's new paid-period start as the new anchor. Never stack old and new subscription allowances.
- Downgrade: take effect at the provider-confirmed period boundary unless the provider reports an immediate change.
- Scheduled cancellation: keep the current paid grant usable until its existing expiry; create no grant after the paid period ends.
- Pause, unpaid, dispute, refund, or expiration: revoke future eligibility and stop new cycle grants.
- Existing consumed credits are not recreated by a later webhook retry.

## 4. Ledger Model

The existing `src/lib/credits-ledger.ts` model becomes the canonical credit model instead of introducing a second incompatible ledger.

### 4.1 `credit_grants`

Each independently expiring credit allocation is a grant.

Required fields include:

- user and optional workspace;
- credit type;
- source type: subscription, referral bonus, top-up, small report, or manual adjustment;
- source reference and idempotency key;
- granted and remaining amounts;
- start and expiry timestamps;
- billing period start and end;
- status and metadata.

Uniqueness requirements:

- one subscription grant per user, subscription, and monthly cycle;
- one referral grant per referral attribution;
- one manual migration grant per migrated legacy balance.

### 4.2 `credit_usage`

Every deduction records which grants funded it, the amount, usage reason, related run/request identifiers, and timestamp.

Bulk reservations record allocation details so cancellation or unfinished-contact release restores credits to the original grants without exceeding the original remaining amounts.

### 4.3 Compatibility balance

`profiles.credits_remaining` remains a server-maintained compatibility mirror of currently usable contact-audit grants. Existing frontend, API, and Google Sheets response shapes can continue returning this number during migration.

Clients must never update the mirror. Atomic database functions update grant balances, usage records, and the compatibility mirror in the same transaction.

## 5. Consumption Order

For contact-audit credits:

1. usable referral rewards, earliest expiry first;
2. current subscription-cycle grant;
3. manual-adjustment grants, earliest expiry first. Top-up products are not currently offered and remain outside this implementation.

Expired, revoked, future-dated, or consumed grants are unavailable.

All credit-consuming surfaces use the same atomic database function:

- Web single check;
- legacy Web bulk route;
- resumable bulk-run reservation;
- Google Sheets batch route;
- public API routes.

Cache hits remain charged exactly like uncached checks. Cache affects processing speed only.

## 6. Referral Lifecycle

### 6.1 Attribution

- Attribution is captured once per referred user.
- Self-referral and invalid codes are rejected.
- Duplicate attribution attempts replay the original attribution.

### 6.2 First paid subscription

The first verified successful payment freezes:

- payment ID;
- paid plan;
- included monthly credits;
- reward amount;
- first-paid timestamp;
- eligibility-review timestamp, 30 days later.

Renewals and duplicate payment events cannot replace this snapshot or create another reward.

### 6.3 Review and issuance

After 30 days, the reward remains eligible only when:

- the snapshotted payment is still completed;
- the referred subscription is still active and paid;
- no refund, dispute, chargeback, reversal, duplicate relationship, self-referral, or fraud disqualification exists.

The agreed delivery trigger is the referrer's first Dashboard load after the review timestamp. A service-role-only atomic function moves the attribution from `pending_review` to `issued` and creates one 60-day referral grant. Concurrent Dashboard loads return the already-issued result without duplicating credits.

Ineligible due rewards move to `disqualified` and are not retried indefinitely.

### 6.4 Reward expiry

The referral grant expires exactly 60 days after issuance, not 60 days after attribution or the referred payment. Remaining reward credits expire independently of subscription credits.

## 7. Dashboard and Website Copy

The Dashboard should distinguish:

- subscription credits remaining;
- referral bonus credits remaining;
- total usable credits;
- nearest expiration where relevant.

The existing referral promotion is accurate only after the ledger and expiry behavior are implemented. Add this user-visible sentence:

> Eligible rewards are added when you next open your Dashboard after the 30-day review period.

Keep the existing statements that rewards equal 10% of first-plan included checks, expire after 60 days, and are unavailable for refunded or fraudulent activity.

Do not expose implementation terms such as RPC, lazy execution, database function, or service role in public copy.

## 8. Reconciliation and Scheduling

A daily authenticated server task performs subscription-cycle reconciliation:

1. expire elapsed grants;
2. find active subscriptions whose current monthly anchor has begun;
3. verify that the provider-paid period covers the anchor;
4. create the missing monthly grant using a unique cycle key;
5. refresh compatibility balances.

The same task refreshes Free accounts to 50 credits on their account-creation monthly anchor. It expires the previous Free subscription-style grant first, so unused Free credits do not roll over.

Payment webhooks remain the primary fast path. The scheduled task is a recovery path for annual monthly issuance and missed or delayed webhooks.

The task must require a dedicated secret and must not accept a user ID or arbitrary grant amount from the caller.

Referral rewards do not require a cron job under the approved design; they are evaluated on the referrer's Dashboard load.

## 9. Migration Strategy

### 9.1 Preflight

- Verify production project identity and migration history.
- Record current profile balances and active subscription state.
- Confirm no unknown local changes.
- Back up affected profile, subscription, bulk-run, and referral rows.

### 9.2 Legacy balance migration

- Active paid users receive a current-cycle subscription grant based on their provider-confirmed plan and cycle.
- Remaining balance above the current-cycle entitlement becomes an explicitly reviewed manual-adjustment grant, preserving legitimate Business/test capacity.
- Free users receive a migration grant equal to their current remaining balance; they do not receive an extra 50 during migration.
- The current Business test-account balance is preserved and is not interpreted as the universal Business plan allowance.
- Existing referral attribution without a completed payment remains `not_eligible_yet` and receives no grant.

### 9.3 Cutover

- Deploy schema and atomic functions before ledger-dependent application code.
- Verify grants and compatibility balances in production.
- Deploy application code and scheduled reconciliation configuration.
- Exercise a non-billable dry-run/reconciliation inspection before any real credit consumption.

## 10. Error Handling and Idempotency

- Grant creation uses unique source references and returns the existing grant on replay.
- Credit consumption and bulk reservation are atomic; insufficient total balance changes nothing.
- Partial processing follows the existing reservation policy; unused credits return to original grants.
- A failed compatibility-mirror update rolls back the entire credit transaction.
- Webhook processing records actionable errors and returns failure when required accounting writes fail.
- Reconciliation can be retried safely after timeout or deployment interruption.

## 11. Testing and Acceptance

### Unit tests

- cycle boundaries for ordinary and end-of-month anchors;
- monthly and annual grant amounts;
- Growth referral reward equals 250 and Scale equals 1,500;
- referral reward expires 60 days after issuance;
- consumption ordering and expired-grant exclusion.

### Database tests

- duplicate cycle creation is idempotent;
- duplicate referral issuance returns zero additional credits;
- concurrent consumption cannot produce a negative grant;
- bulk release restores exact original allocations;
- anon and authenticated roles cannot execute privileged accounting functions.

### Integration tests

- monthly purchase and renewal;
- annual purchase followed by monthly anchor reconciliation;
- refund, dispute, pause, cancellation, and expiration;
- Web, API, Sheets, and 5,000-contact resumable bulk runs;
- Dashboard totals equal grant totals and API/Sheets returned balances;
- referral payment, 30-day review, Dashboard-triggered issuance, and 60-day expiry.

### Production acceptance

- all local tests and production build pass;
- migrations and Supabase advisors are reviewed;
- production deployment reaches READY;
- runtime logs contain no new accounting errors;
- production balances are sampled against ledger sums without exposing secrets or changing unrelated users.

## 12. Rollback

- Keep the pre-cutover profile balance snapshot.
- Application rollback may read the compatibility mirror while ledger writes are disabled.
- Database rollback must not drop usage or grant history; disable new ledger functions and restore mirrors from the verified snapshot if required.
- Never reverse by regranting every historical transaction without allocation reconciliation.

## 13. Explicit Non-Goals

- changing risk scores or decision boundaries;
- changing cache charging policy;
- changing Google Sheets or Web result detail columns;
- introducing cash, transferable, or refundable referral rewards;
- defining a universal Business allowance;
- implementing an unrelated organization/workspace billing redesign.
