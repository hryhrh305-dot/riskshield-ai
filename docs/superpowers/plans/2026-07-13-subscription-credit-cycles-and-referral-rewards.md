# Secwyn Subscription Credit Cycles and Referral Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Secwyn's single undifferentiated balance with an atomic grant ledger that refreshes monthly and annual subscriptions on purchase-date anchors while preserving 60-day referral rewards.

**Architecture:** `credit_grants` and `credit_usage` become authoritative; `profiles.credits_remaining` remains a transactionally maintained compatibility mirror. Payment webhooks create the fast-path grant, a daily authenticated Vercel Cron reconciles missing monthly grants, and all Web/API/Sheets/bulk consumption uses service-role-only PostgreSQL functions.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Supabase/PostgreSQL 17, Creem webhooks, Vercel Cron.

## Global Constraints

- Git root must remain exactly `D:/ai-saas-mvp`; product is Secwyn, not Flowwyn.
- Canonical monthly credits: Free 50, Starter 500, Growth 2,500, Scale 15,000, Business contract-defined.
- Referral rewards: Starter 50, Growth 250, Scale 1,500, Business manual review.
- Cache hits remain charged; scoring thresholds remain ALLOW 0-25, REVIEW 26-65, BLOCK 66-100.
- Preserve Google Sheets `x-api-key` compatibility and all existing result/export columns.
- Database functions must be service-role-only; revoke `PUBLIC`, `anon`, and `authenticated` execution.
- No production SQL, secret change, push, or deployment without explicit production authorization.
- Current local commits `5a62275` and `d4b31db` are intentionally unpushed; referral code from `5a62275` must be adapted to ledger grants before release.

---

## File Map

- Create `src/lib/credit-cycle.ts`: purchase-anchor cycle arithmetic.
- Create `src/lib/credit-accounting.ts`: server wrappers for grant, consume, reserve, release, reconcile, and summary RPCs.
- Modify `src/lib/credits-ledger.ts`: enforce referral-first consumption policy in pure planning utilities.
- Modify `src/lib/credits-ledger-server.ts`: use the finalized schema and typed RPC results.
- Modify `src/lib/legacy-credits.ts`: replace per-credit `consume_credit` loop with one atomic ledger consumption.
- Modify `src/lib/referral-rewards.ts`: issue a 60-day referral grant instead of directly increasing a profile balance.
- Create `supabase/migrations/202607130005_credit_grant_ledger.sql`: ledger tables, backfill, atomic functions, grants, indexes.
- Modify `supabase/migrations/202607130004_referral_reward_delivery.sql`: referral snapshot columns and service-only review function compatible with the ledger.
- Modify payment routes: create first-cycle grants and referral snapshots idempotently.
- Modify bulk-run SQL/repository: record reservation allocations and restore the same allocations on release.
- Create `src/app/api/cron/credit-refresh/route.ts` and `vercel.json`: daily reconciliation protected by `CRON_SECRET`.
- Modify referral/dashboard routes and dashboard UI: issue due rewards on load and show subscription/referral/total balances.
- Add focused `tests/bulk-run-*.test.ts` files so they are included by the current Vitest configuration.

---

### Task 1: Purchase-Anchor Cycle Arithmetic

**Files:**
- Create: `src/lib/credit-cycle.ts`
- Test: `tests/bulk-run-credit-cycle.test.ts`

**Interfaces:**
- Produces: `getMonthlyCycle(anchorIso, at): { start: string; end: string; cycleKey: string }`
- Produces: `isCycleInsidePaidPeriod(cycleStart, paidStart, paidEnd): boolean`

- [ ] **Step 1: Write failing tests for ordinary, annual, and end-of-month anchors**

```ts
expect(getMonthlyCycle("2026-08-15T10:30:00.000Z", new Date("2026-09-16T00:00:00Z"))).toEqual({
  start: "2026-09-15T10:30:00.000Z",
  end: "2026-10-15T10:30:00.000Z",
  cycleKey: "2026-09-15T10:30:00.000Z",
});
expect(getMonthlyCycle("2026-01-31T08:00:00.000Z", new Date("2026-02-28T12:00:00Z")).start)
  .toBe("2026-02-28T08:00:00.000Z");
expect(getMonthlyCycle("2026-01-31T08:00:00.000Z", new Date("2026-03-31T12:00:00Z")).start)
  .toBe("2026-03-31T08:00:00.000Z");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/bulk-run-credit-cycle.test.ts`  
Expected: FAIL because `src/lib/credit-cycle.ts` does not exist.

- [ ] **Step 3: Implement UTC anchor calculation without iterative month drift**

```ts
export function getMonthlyCycle(anchorIso: string, at: Date) {
  const anchor = new Date(anchorIso);
  if (Number.isNaN(anchor.getTime())) throw new Error("INVALID_CREDIT_ANCHOR");
  const boundary = (monthOffset: number) => {
    const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + monthOffset, 1,
      anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds()));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
    return first;
  };
  let offset = (at.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + at.getUTCMonth() - anchor.getUTCMonth();
  if (boundary(offset).getTime() > at.getTime()) offset -= 1;
  const start = boundary(Math.max(0, offset));
  const end = boundary(Math.max(0, offset) + 1);
  return { start: start.toISOString(), end: end.toISOString(), cycleKey: start.toISOString() };
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- tests/bulk-run-credit-cycle.test.ts && npm test`  
Expected: focused PASS; full suite PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/lib/credit-cycle.ts tests/bulk-run-credit-cycle.test.ts
git commit -m "Add anchored monthly credit cycles"
```

### Task 2: Authoritative Grant Ledger Schema

**Files:**
- Create: `supabase/migrations/202607130005_credit_grant_ledger.sql`
- Test: `tests/bulk-run-credit-ledger-migration.test.ts`

**Interfaces:**
- Produces tables `credit_grants`, `credit_usage`, `credit_reservation_allocations`.
- Produces RPCs `grant_cycle_credits`, `consume_grant_credits`, `reserve_grant_credits`, `release_grant_reservation`, `get_credit_summary`, `reconcile_credit_cycles`.

- [ ] **Step 1: Write a source-contract test that requires RLS, uniqueness, compatibility mirror updates, and service-only grants**

```ts
expect(sql).toContain("create table if not exists public.credit_grants");
expect(sql).toContain("unique (user_id, source_type, source_ref)");
expect(sql).toContain("create or replace function public.consume_grant_credits");
expect(sql).toContain("source_type = 'referral_bonus'");
expect(sql).toContain("credits_remaining = v_total_remaining");
expect(sql).toContain("from public, anon, authenticated");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/bulk-run-credit-ledger-migration.test.ts`  
Expected: FAIL because the migration is absent.

- [ ] **Step 3: Create tables with explicit checks and indexes**

```sql
create table public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_type text not null check (credit_type in ('contact_audit','client_report')),
  source_type text not null check (source_type in ('subscription','referral_bonus','manual_adjustment')),
  source_ref text not null,
  granted_amount integer not null check (granted_amount > 0),
  remaining_amount integer not null check (remaining_amount between 0 and granted_amount),
  starts_at timestamptz not null,
  expires_at timestamptz,
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  status text not null default 'active' check (status in ('active','expired','consumed','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_ref)
);
```

`credit_usage` must reference a grant and store a positive amount, usage reason, request/run idempotency reference, and `created_at`. Reservation allocations must uniquely pair `bulk_run_id` and `grant_id` and track reserved/released amounts.

- [ ] **Step 4: Implement atomic SQL functions**

`consume_grant_credits` must lock usable grants, order referral grants first and then subscription/manual grants, deduct in one transaction, insert usage rows, expire elapsed grants, recompute `profiles.credits_remaining`, and return `{ success, deducted, remaining }`. `grant_cycle_credits` must return the existing grant on unique-key replay. Every privileged function must include `security definer set search_path = ''`, followed by exact revokes and a service-role grant.

- [ ] **Step 5: Add a non-mutating migration preflight query to the migration header comments**

```sql
-- Preflight: select plan, subscription_status, count(*), sum(credits_remaining)
-- from public.profiles group by plan, subscription_status order by plan, subscription_status;
```

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/bulk-run-credit-ledger-migration.test.ts && npm test`  
Expected: PASS.

```powershell
git add -- supabase/migrations/202607130005_credit_grant_ledger.sql tests/bulk-run-credit-ledger-migration.test.ts
git commit -m "Add atomic credit grant ledger"
```

### Task 3: Server Credit Accounting Adapter

**Files:**
- Create: `src/lib/credit-accounting.ts`
- Modify: `src/lib/credits-ledger.ts`
- Modify: `src/lib/credits-ledger-server.ts`
- Modify: `src/lib/legacy-credits.ts`
- Modify: `src/app/api/web-risk/route.ts`
- Modify: `src/app/api/bulk-check/route.ts`
- Modify: `src/app/api/v1/email/batch-check/route.ts`
- Modify: `src/app/api/v1/email/check/route.ts`
- Modify: `src/app/api/v1/ip/check/route.ts`
- Modify: `src/app/api/v1/risk/check/route.ts`
- Modify: `src/app/api/v1/pre-send/check/route.ts`
- Test: `tests/bulk-run-credit-accounting.test.ts`

**Interfaces:**
- Produces `consumeContactCredits({ supabase, userId, amount, reason, requestId })`.
- Produces `getCreditSummary({ supabase, userId })`.
- Preserves `LegacyCreditResult` response fields.

- [ ] **Step 1: Write failing tests proving one RPC call replaces the per-credit loop and replay uses a request ID**

```ts
expect(source).toContain('rpc("consume_grant_credits"');
expect(source).not.toContain("for (let i = 0; i < safeRequiredCredits; i += 1)");
expect(source).toContain("p_request_id");
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/bulk-run-credit-accounting.test.ts`  
Expected: FAIL on the legacy loop.

- [ ] **Step 3: Implement the adapter and map RPC data back to the existing response contract**

```ts
const { data, error } = await supabase.rpc("consume_grant_credits", {
  p_user_id: userId,
  p_amount: amount,
  p_usage_reason: reason,
  p_request_id: requestId,
});
return error ? failure(error) : {
  ok: data.success,
  requiredCredits: amount,
  creditsAvailable: data.remaining + data.deducted,
  creditsRemaining: data.remaining,
  deducted: data.deducted,
};
```

- [ ] **Step 4: Update every legacy call site to pass a stable server request ID**

Use route-provided idempotency keys where available; otherwise generate one request UUID per incoming HTTP request and reuse it for the entire operation. Do not derive idempotency solely from email content because repeated paid scans must still charge. Update `sortCreditGrantsForConsumption` so active `referral_bonus` grants are ordered before subscription grants, with earliest referral expiry first.

- [ ] **Step 5: Run tests and commit**

Run: `npm test && npm run build`  
Expected: all tests and build PASS.

```powershell
git add -- src/lib/credit-accounting.ts src/lib/credits-ledger.ts src/lib/credits-ledger-server.ts src/lib/legacy-credits.ts src/app/api/web-risk/route.ts src/app/api/bulk-check/route.ts src/app/api/v1/email/batch-check/route.ts src/app/api/v1/email/check/route.ts src/app/api/v1/ip/check/route.ts src/app/api/v1/risk/check/route.ts src/app/api/v1/pre-send/check/route.ts tests/bulk-run-credit-accounting.test.ts
git commit -m "Route credit consumption through grant ledger"
```

### Task 4: Bulk Reservations and Exact Releases

**Files:**
- Modify: `supabase/migrations/202607130005_credit_grant_ledger.sql`
- Modify: `src/lib/bulk-runs/repository.ts`
- Test: `tests/bulk-run-credit-reservations.test.ts`

**Interfaces:**
- `reserve_grant_credits` returns run ID, reserved amount, remaining total, and replay status.
- `release_grant_reservation` restores only unused allocations to their original grants.

- [ ] **Step 1: Write failing tests for reservation replay and partial release**

Require unique `(bulk_run_id, grant_id)` allocations, `released_amount <= reserved_amount`, and no direct `profiles.credits_remaining = credits_remaining +/-` in bulk RPCs.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/bulk-run-credit-reservations.test.ts`  
Expected: FAIL because bulk SQL directly changes the profile balance.

- [ ] **Step 3: Replace reservation/release internals while preserving public RPC signatures**

Keep `create_bulk_run` and `release_bulk_run_unfinished` signatures stable. Internally call ledger allocation logic, persist allocation rows, and recompute the compatibility mirror transactionally.

- [ ] **Step 4: Test 101, 500, 2,500, and 5,000 reservations plus cancellation replay**

Run: `npm test -- tests/bulk-run-credit-reservations.test.ts tests/bulk-run-service.test.ts`  
Expected: PASS with exact one-time reservation and exact unused release.

- [ ] **Step 5: Commit**

```powershell
git add -- supabase/migrations/202607130005_credit_grant_ledger.sql src/lib/bulk-runs/repository.ts tests/bulk-run-credit-reservations.test.ts
git commit -m "Allocate bulk reservations across credit grants"
```

### Task 5: Payment Webhooks and Monthly Grant Creation

**Files:**
- Modify: `src/app/api/payment/webhook/route.ts`
- Modify: `src/app/api/payment/confirm-redirect/route.ts`
- Modify: `src/lib/creem.ts`
- Modify: `src/lib/referral-rewards.ts`
- Test: `tests/bulk-run-payment-credit-grants.test.ts`

**Interfaces:**
- Payment routes call `grantSubscriptionCycle({ userId, subscriptionId, plan, anchor, cycle })`.
- Referral snapshot calls `markReferralFirstPayment` only after a completed payment row exists.

- [ ] **Step 1: Write failing tests for canonical amounts and duplicate webhook replay**

Assert Free 50, Starter 500, Growth 2,500, Scale 15,000; the same transaction and cycle key must create one grant; Business requires an explicit contract amount.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/bulk-run-payment-credit-grants.test.ts`  
Expected: FAIL because payment routes directly overwrite `credits_remaining`.

- [ ] **Step 3: Replace direct balance overwrites with cycle grants**

Remove `credits_remaining: shouldUpgrade ? credits : ...` from webhook and redirect confirmation. Persist provider interval, paid-period start/end, and anchor on `subscriptions`. For an immediate upgrade, revoke the unused old subscription grant, establish the provider-confirmed new anchor, and issue the new full-plan grant once.

- [ ] **Step 4: Keep refund and dispute handling ledger-aware**

Refund/dispute must revoke the affected subscription grant and future eligibility, refresh the mirror, and leave usage history immutable. It must not revoke unrelated 60-day referral grants already earned by that user.

- [ ] **Step 5: Run payment tests and commit**

Run: `npm test -- tests/creem.test.mjs tests/bulk-run-payment-credit-grants.test.ts && npm run build`  
Expected: PASS.

```powershell
git add -- src/app/api/payment/webhook/route.ts src/app/api/payment/confirm-redirect/route.ts src/lib/creem.ts src/lib/referral-rewards.ts tests/creem.test.mjs tests/bulk-run-payment-credit-grants.test.ts
git commit -m "Issue subscription credits by billing cycle"
```

### Task 6: Daily Annual/Free Reconciliation

**Files:**
- Create: `src/app/api/cron/credit-refresh/route.ts`
- Create: `vercel.json`
- Create: `src/lib/credit-reconciliation.ts`
- Test: `tests/bulk-run-credit-reconciliation.test.ts`

**Interfaces:**
- Produces `reconcileDueCreditCycles({ supabase, now, limit })` with idempotent counts.
- Cron accepts only `Authorization: Bearer ${CRON_SECRET}`.

- [ ] **Step 1: Write failing route and cycle tests**

Cover an August 15 annual purchase receiving grants on August 15 and September 15, no duplicate on repeated daily runs, Free registration-anchor refresh, and 401 when the secret is absent or wrong.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/bulk-run-credit-reconciliation.test.ts`  
Expected: FAIL because the route and service are absent.

- [ ] **Step 3: Implement a thin authenticated GET route**

```ts
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await reconcileDueCreditCycles({ now: new Date(), limit: 500 }));
}
```

- [ ] **Step 4: Configure daily production-only scheduling**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/credit-refresh", "schedule": "15 0 * * *" }]
}
```

Vercel schedules in UTC and sends `Authorization: Bearer $CRON_SECRET`; cron runs only on production deployments. Verify `CRON_SECRET` exists in Production before deployment.

- [ ] **Step 5: Run tests/build and commit**

Run: `npm test -- tests/bulk-run-credit-reconciliation.test.ts && npm run build`  
Expected: PASS and route listed in build output.

```powershell
git add -- src/app/api/cron/credit-refresh/route.ts src/lib/credit-reconciliation.ts vercel.json tests/bulk-run-credit-reconciliation.test.ts
git commit -m "Reconcile monthly credits for annual plans"
```

### Task 7: Referral Review, 60-Day Grant, and Public Copy

**Files:**
- Modify: `supabase/migrations/202607130004_referral_reward_delivery.sql`
- Modify: `src/lib/referral-rewards.ts`
- Modify: `src/app/api/referrals/me/route.ts`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `tests/bulk-run-referral-rewards.test.ts`

**Interfaces:**
- `issue_due_referral_reward` creates one `referral_bonus` grant with `expires_at = issued_at + interval '60 days'`.
- Dashboard summary returns subscription, referral, total, and nearest expiry.

- [ ] **Step 1: Extend failing tests to require a grant rather than direct profile addition**

```ts
expect(sql).toContain("source_type, 'referral_bonus'");
expect(sql).toContain("now() + interval '60 days'");
expect(sql).not.toContain("credits_remaining = credits_remaining + v_reward");
expect(dashboard).toContain("Eligible rewards are added when you next open your Dashboard after the 30-day review period.");
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/bulk-run-referral-rewards.test.ts`  
Expected: FAIL because commit `5a62275` directly increments the profile balance.

- [ ] **Step 3: Make issuance create an idempotent 60-day grant**

Use `source_ref = 'referral:' || attribution.id`, update attribution to `issued`, and refresh the compatibility mirror in the same transaction. Ineligible due rewards become `disqualified`.

- [ ] **Step 4: Update Dashboard values and copy**

Show total usable credits as the primary balance, with subscription and referral breakdown below. Keep the 10%, 30-day, 60-day, fraud/refund, non-cash, non-transferable, and non-refundable statements.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- tests/bulk-run-referral-rewards.test.ts && npm run build`  
Expected: PASS.

```powershell
git add -- supabase/migrations/202607130004_referral_reward_delivery.sql src/lib/referral-rewards.ts src/app/api/referrals/me/route.ts 'src/app/(dashboard)/dashboard/page.tsx' tests/bulk-run-referral-rewards.test.ts
git commit -m "Issue expiring referral credit grants"
```

### Task 8: Migration Backfill and Dry-Run Audit

**Files:**
- Modify: `supabase/migrations/202607130005_credit_grant_ledger.sql`
- Create: `docs/operations/CREDIT_LEDGER_PRODUCTION_RUNBOOK.md`
- Test: `tests/bulk-run-credit-ledger-backfill.test.ts`

**Interfaces:**
- Backfill preserves every current usable balance exactly once.
- Produces audit queries comparing profile mirrors to grant sums.

- [ ] **Step 1: Write failing backfill contract tests**

Require Free migration grants equal current remaining balance, active paid current-cycle grants, excess balance manual-adjustment grants, Business preservation, and no automatic reward for the existing unpaid referral.

- [ ] **Step 2: Add idempotent backfill SQL**

Use deterministic `source_ref` values: `legacy-profile:<user_id>:<cutover-date>`, `subscription:<subscription_id>:<cycle-start>`, and `referral:<attribution_id>`. Never add 50 on top of an existing Free balance.

- [ ] **Step 3: Write the complete runbook**

Include exact preflight counts, backup queries, migration order (`004` then `005`), post-migration mirror comparison, Supabase advisor checks, rollback conditions, Vercel environment requirement, and the no-push-before-schema gate.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- tests/bulk-run-credit-ledger-backfill.test.ts && git diff --check`  
Expected: PASS.

```powershell
git add -- supabase/migrations/202607130005_credit_grant_ledger.sql docs/operations/CREDIT_LEDGER_PRODUCTION_RUNBOOK.md tests/bulk-run-credit-ledger-backfill.test.ts
git commit -m "Prepare credit ledger production backfill"
```

### Task 9: Full Local Acceptance

**Files:**
- Review all files changed by Tasks 1-8.

- [ ] **Step 1: Run complete automated gates**

Run: `npm test`  
Expected: all tests PASS.

Run: `npm run build`  
Expected: optimized production build PASS; cron route appears.

Run: `git diff --check`  
Expected: no whitespace errors.

- [ ] **Step 2: Verify locked contracts**

Confirm scoring boundaries remain 0-25/26-65/66-100, cache is charged, Google Sheets remains capped at 5,000 user contacts with 100-contact internal requests, and Code.gs download equals `google-sheets-addon/Code.gs` byte-for-byte.

- [ ] **Step 3: Review repository state**

Run: `git status --short`, `git log --oneline origin/main..HEAD`, and `git diff --stat origin/main..HEAD`.  
Expected: only approved credit/referral/design changes; no Flowwyn/J-drive paths or secrets.

- [ ] **Step 4: Stop for production authorization**

Report the exact migrations, `CRON_SECRET` requirement, commits to push, production impact, rollback snapshot, and validation evidence. Do not execute SQL or push until the user explicitly authorizes production release.

### Task 10: Controlled Production Release

**Files:**
- No new source files; execute the approved runbook.

- [ ] **Step 1: Verify production identity and backup affected rows**

Confirm Supabase project `njhjiavnidssjvnkcxfo`, Vercel project `riskshield-api` for Secwyn, `main`, clean tree, and exact origin divergence. Save balance/subscription/referral/bulk-run audit results without printing secrets.

- [ ] **Step 2: Stage `CRON_SECRET` in Vercel Production**

Use a randomly generated high-entropy value; never print it. Verify only that the variable is present. A redeploy is required after environment changes.

- [ ] **Step 3: Apply migrations in order and verify**

Apply `202607130004_referral_reward_delivery.sql`, then `202607130005_credit_grant_ledger.sql`. Verify tables, indexes, RLS, function privileges, grant sums, and compatibility mirrors. Run Supabase security/performance advisors and distinguish new findings from existing technical debt.

- [ ] **Step 4: Push `main` and wait for production READY**

Stage only approved files, push once, confirm the deployment SHA and aliases include `www.secwyn.com`, and inspect build/runtime errors.

- [ ] **Step 5: Perform non-destructive production checks**

Call the cron route without auth and expect 401. Use the authorized cron request once and expect an idempotent summary. Load Dashboard/referral summary, confirm balances equal ledger sums, and verify the existing unpaid referral remains `not_eligible_yet`.

- [ ] **Step 6: Perform controlled paid-path acceptance only with the designated test account**

Record before/after balance and grants for one single check, one cached repeat, one 101-contact Sheets run, and one 101-contact Web run. Confirm every paid check charges once, Sheets/Web balances match, and no production runtime errors appear.

- [ ] **Step 7: Final status and rollback readiness**

Report deployment URL, commit SHA, migration versions, cron registration, test evidence, exact balance deltas, known existing advisor findings, and rollback snapshot location.
