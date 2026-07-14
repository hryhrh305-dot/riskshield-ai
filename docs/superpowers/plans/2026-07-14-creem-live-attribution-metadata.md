# Creem Live Attribution Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the smallest privacy-safe E8 attribution metadata contract on new Creem Live checkouts and add enough sanitized diagnostics to detect and roll back checkout or webhook-sidecar failures quickly.

**Architecture:** Keep the existing Creem checkout and signed webhook paths as the billing source of truth. Narrow the optional metadata builder to three opaque attribution fields, retain the legacy four fields for every checkout, and use the existing production feature flag as the rollback boundary. Add sanitized warnings only at the enhanced-checkout rejection and best-effort subscription-sidecar failure points.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Vercel Production, Creem Live API, Supabase Postgres.

## Global Constraints

- Canonical Git root is exactly `D:/ai-saas-mvp`; run `git rev-parse --show-toplevel` before every action.
- Only one writer modifies files; execute inline in the current session without subagents.
- Do not change Creem API keys, webhook secret, product IDs, prices, success URL, customer portal, plans, credit grants, referrals, risk scoring, Google Sheets, or bulk checking.
- Do not add a database migration.
- Keep `SES_EVENT_INGESTION_ENABLED=false`, `OUTREACH_SAFETY_AUTOPAUSE_ENABLED=false`, and `OUTREACH_GLOBAL_KILL_SWITCH=true`.
- Do not print secrets, customer email, raw webhook bodies, signatures, cookies, CID values, HMAC keys, or full metadata objects.
- No real payment is authorized in this plan. A checkout session may be created, but payment completion requires separate authorization and user action.
- Primary rollback: set `CREEM_ATTRIBUTION_METADATA_ENABLED=false` and redeploy the already-validated commit.

---

### Task 1: Lock the exact metadata contract with TDD

**Files:**
- Modify: `tests/e8-observability.test.ts`
- Modify: `src/lib/e8/creem.ts`

**Interfaces:**
- Consumes: `buildCreemCheckoutMetadata(base, attribution, requestId, enabled)`.
- Produces: the legacy four metadata fields plus only `checkout_request_id`, `attribution_id`, and optional `campaign_id` when enabled and attributed.

- [ ] **Step 1: Write failing contract tests**

Add tests that assert the complete enabled shape, the exact legacy shape when attribution is absent, and removal of forbidden fields:

```ts
it("adds only the approved opaque fields when live metadata is enabled", () => {
  expect(buildCreemCheckoutMetadata(base, {
    attribution_id: "550e8400-e29b-41d4-a716-446655440000",
    campaign_id: "550e8400-e29b-41d4-a716-446655440001",
  }, "request-1", true)).toEqual({
    ...base,
    checkout_request_id: "request-1",
    attribution_id: "550e8400-e29b-41d4-a716-446655440000",
    campaign_id: "550e8400-e29b-41d4-a716-446655440001",
  });
});

it("keeps the legacy shape when enabled without bound attribution", () => {
  expect(buildCreemCheckoutMetadata(base, null, "request-1", true)).toEqual(base);
});

it("never forwards prospect or message identifiers to Creem", () => {
  const result = buildCreemCheckoutMetadata(base, {
    attribution_id: "550e8400-e29b-41d4-a716-446655440000",
    prospect_id: "550e8400-e29b-41d4-a716-446655440002",
    outreach_message_id: "550e8400-e29b-41d4-a716-446655440003",
  } as Parameters<typeof buildCreemCheckoutMetadata>[1], "request-1", true);
  expect(result).not.toHaveProperty("prospect_id");
  expect(result).not.toHaveProperty("outreach_message_id");
});
```

- [ ] **Step 2: Run the focused tests and confirm the new contract fails**

Run:

```powershell
npm test -- --run tests/e8-observability.test.ts
```

Expected: the enabled-field test fails because the current implementation still forwards `prospect_id` or `outreach_message_id`.

- [ ] **Step 3: Implement the minimal field narrowing**

Change the attribution type and returned object in `buildCreemCheckoutMetadata` to:

```ts
attribution: { attribution_id: string; campaign_id?: string } | null,
```

```ts
return {
  ...base,
  checkout_request_id: requestId,
  attribution_id: attribution.attribution_id,
  ...(attribution.campaign_id ? { campaign_id: attribution.campaign_id } : {}),
};
```

Narrow the `getCreemAttributionMetadata` database selection to fields still needed by checkout creation and the existing `checkout_started` event:

```ts
.select("id,campaign_id,anonymous_id")
```

Return only `attribution_id`, optional `campaign_id`, and `anonymous_id`.

- [ ] **Step 4: Run the focused tests and confirm green**

Run:

```powershell
npm test -- --run tests/e8-observability.test.ts
```

Expected: every test in `e8-observability.test.ts` passes.

- [ ] **Step 5: Commit the metadata contract**

```powershell
git add -- src/lib/e8/creem.ts tests/e8-observability.test.ts
git commit -m "fix: narrow Creem attribution metadata"
```

---

### Task 2: Add sanitized failure detection with TDD

**Files:**
- Modify: `tests/e8-observability.test.ts`
- Modify: `src/lib/e8/creem.ts`
- Modify: `src/app/api/create-checkout/route.ts`
- Modify: `src/app/api/payment/webhook/route.ts`

**Interfaces:**
- Produces: `safeE8ErrorCode(error: unknown): string` returning only an allowlisted provider error code, JavaScript error name, or `unknown`.
- Produces: `[e8-creem][checkout-rejected]` and `[e8-creem][subscription-sidecar-failed]` sanitized operational warnings.

- [ ] **Step 1: Write failing diagnostic tests**

Add the import and tests:

```ts
import { buildCreemCheckoutMetadata, classifyCreemSubscriptionPaid, safeE8ErrorCode } from "../src/lib/e8/creem";

it("reduces operational errors to a short non-sensitive code", () => {
  expect(safeE8ErrorCode(Object.assign(new Error("customer@example.com"), { code: "CREEM_REJECTED" }))).toBe("CREEM_REJECTED");
  expect(safeE8ErrorCode(new TypeError("customer@example.com"))).toBe("TypeError");
  expect(safeE8ErrorCode("customer@example.com")).toBe("unknown");
});
```

Extend the integration source-contract test:

```ts
expect(checkout).toContain('[e8-creem][checkout-rejected]');
expect(webhook).toContain('[e8-creem][subscription-sidecar-failed]');
expect(checkout).not.toContain('console.warn("[e8-creem][checkout-rejected]", metadata');
expect(webhook).not.toContain('console.warn("[e8-creem][subscription-sidecar-failed]", payload');
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```powershell
npm test -- --run tests/e8-observability.test.ts
```

Expected: failure because `safeE8ErrorCode` and the two warning labels do not exist.

- [ ] **Step 3: Implement the safe error-code helper**

Add to `src/lib/e8/creem.ts`:

```ts
export function safeE8ErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return /^[A-Za-z0-9_:-]{1,64}$/.test(error.code) ? error.code : "unknown";
  }
  return error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(error.name)
    ? error.name
    : "unknown";
}
```

- [ ] **Step 4: Log explicit enhanced-checkout rejection safely**

Import `safeE8ErrorCode` only where required. Immediately before returning the existing Creem non-OK response in `create-checkout/route.ts`, add:

```ts
if (getE8Flags().creemMetadata && e8Attribution) {
  console.warn("[e8-creem][checkout-rejected]", {
    status: response.status,
    requestId,
  });
}
```

Do not log `data`, `metadata`, `user`, headers, or the Creem response body.

- [ ] **Step 5: Log webhook sidecar failure safely**

Import `safeE8ErrorCode` in `payment/webhook/route.ts` and replace only the empty E8 sidecar catch body:

```ts
} catch (error) {
  console.warn("[e8-creem][subscription-sidecar-failed]", {
    eventType: eventType || "unknown",
    code: safeE8ErrorCode(error),
  });
}
```

Do not change webhook signature verification, the billing switch, the `after` boundary, the 500 ms timeout, the final response, or any credit/referral function.

- [ ] **Step 6: Run focused tests and confirm green**

Run:

```powershell
npm test -- --run tests/e8-observability.test.ts
```

Expected: every focused test passes and no assertion permits raw metadata or webhook payload logging.

- [ ] **Step 7: Commit sanitized diagnostics**

```powershell
git add -- src/lib/e8/creem.ts src/app/api/create-checkout/route.ts src/app/api/payment/webhook/route.ts tests/e8-observability.test.ts
git commit -m "chore: expose safe Creem E8 failures"
```

---

### Task 3: Full local acceptance and baseline review

**Files:**
- Review: all files changed since `f8d1182`

**Interfaces:**
- Consumes: the exact metadata contract and sanitized logging labels from Tasks 1–2.
- Produces: a tested commit that is safe to deploy with the production metadata flag still disabled.

- [ ] **Step 1: Review the complete scoped diff**

Run:

```powershell
git diff --stat f8d1182..HEAD
git diff --name-status f8d1182..HEAD
git diff f8d1182..HEAD -- src/lib/e8/creem.ts src/app/api/create-checkout/route.ts src/app/api/payment/webhook/route.ts tests/e8-observability.test.ts
git diff --check f8d1182..HEAD
```

Expected: only the four approved implementation/test files differ; no price, product ID, credit, referral, scoring, bulk, Sheets, SES, or safety-autopause logic changes.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
npm test -- --run
```

Expected: 25 test files and at least 127 tests pass with zero failures.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: exit code 0. Record the existing Next.js middleware deprecation warning and skipped type-validation baseline without claiming they were fixed by this task.

- [ ] **Step 4: Confirm repository state**

Run:

```powershell
git status --short
git rev-list --left-right --count origin/main...HEAD
```

Expected: clean working tree. The local branch may be ahead only by the approved design and implementation commits.

---

### Task 4: Flag-off production deployment and regression gate

**Files:**
- No source changes.
- Production configuration: `CREEM_ATTRIBUTION_METADATA_ENABLED=false`.

**Interfaces:**
- Produces: the tested code running in production while checkout metadata remains on the legacy four-field contract.

- [ ] **Step 1: Confirm the production flag is false and push approved commits**

Update the production value to the literal `false` without printing any secret, then push `main`:

```powershell
"false" | npx vercel env update CREEM_ATTRIBUTION_METADATA_ENABLED production --yes
git push origin main
```

Expected: the environment update and push both succeed. Wait for the automatic production deployment to become `Ready` and for `https://www.secwyn.com` to point to it.

- [ ] **Step 2: Run public regression smoke checks**

Verify HTTP behavior for:

```text
https://www.secwyn.com/
https://www.secwyn.com/pricing
https://www.secwyn.com/login
https://www.secwyn.com/reset-password
https://www.secwyn.com/bulk-check
```

Expected: public pages return 200 and protected bulk checking redirects unauthenticated users as before.

- [ ] **Step 3: Verify one legacy Live checkout without payment**

Using only the internal test account, create one checkout from the Pricing page and stop before entering or confirming payment details.

Expected: `/api/create-checkout` returns 200 with a valid Creem Live checkout URL; the newest pending payment row has the expected user, product, plan, amount, and currency; no new Vercel error appears.

- [ ] **Step 4: Stop and roll back the code deployment if baseline checkout fails**

If the flag-off checkout path fails, do not enable Live metadata. Restore the previously known-good production deployment alias and report the exact status/log evidence. Do not change payment data manually.

---

### Task 5: Controlled Live metadata enablement and no-charge verification

**Files:**
- No source changes.
- Production configuration: `CREEM_ATTRIBUTION_METADATA_ENABLED=true`.

**Interfaces:**
- Produces: E8 attribution metadata on new, validly attributed Creem Live checkouts.

- [ ] **Step 1: Enable the production flag and redeploy the tested commit**

```powershell
"true" | npx vercel env update CREEM_ATTRIBUTION_METADATA_ENABLED production --yes
npx vercel --prod --yes
```

Expected: a production deployment reaches `Ready`, `www.secwyn.com` points to it, and SES/Safety Autopause remain disabled.

- [ ] **Step 2: Establish a bound internal attribution session**

Use the internal test account in a first-party `www.secwyn.com` browser session. Trigger the existing attribution observer and verify `/api/e8/attribution/session` returns 200 with the secure anonymous and attribution cookies. Confirm the database attribution row is bound to that authenticated user without printing the user email.

- [ ] **Step 3: Create exactly one attributed Live checkout without payment**

Select one existing self-serve plan from Pricing, create the checkout, capture only the opaque checkout ID/URL, and stop before payment confirmation.

Expected: `/api/create-checkout` returns 200; the Creem checkout reports mode `prod`; product, plan, billing interval, amount, customer, and success URL match the flag-off baseline.

- [ ] **Step 4: Verify the exact metadata and Secwyn records**

Retrieve the checkout through the Creem Live API or dashboard. Expected metadata keys are exactly:

```text
user_id
plan
billing_interval
source
checkout_request_id
attribution_id
campaign_id (only when present)
```

Confirm there is no `prospect_id`, `outreach_message_id`, email, CID, UTM, Cookie, HMAC, IP, or browser data. Confirm exactly one matching `checkout_started` event and a correctly shaped pending payment row in Supabase.

- [ ] **Step 5: Apply immediate rollback rules**

If checkout is non-2xx, URL is invalid, mode/product/amount/interval/customer/success URL differs, metadata is missing/extra, sensitive data is present, or new checkout 5xx errors appear:

```powershell
"false" | npx vercel env update CREEM_ATTRIBUTION_METADATA_ENABLED production --yes
npx vercel --prod --yes
```

Expected: subsequent new checkouts return to the legacy four-field contract. Do not delete the already-created checkout or E8 audit records.

---

### Task 6: Initial observation window and final report

**Files:**
- No source changes.

**Interfaces:**
- Produces: an evidence-based Live checkout-level acceptance report and an explicit statement that paid-webhook propagation remains unverified until a real payment occurs.

- [ ] **Step 1: Check immediately after enablement**

Query Vercel logs for `/api/create-checkout` non-2xx responses, `Checkout error`, `[e8-creem][checkout-rejected]`, and `[e8-creem][subscription-sidecar-failed]`. Query Supabase for the controlled `checkout_started` and pending payment records. Do not print raw payloads or secrets.

Expected: no new error label; one controlled checkout event and one expected pending payment row.

- [ ] **Step 2: Repeat at 5, 15, and 30 minutes**

Repeat the same log, Creem checkout, Supabase record, and public smoke checks. Do not create additional checkouts during observation.

Expected: no new regression or sensitive logging. If a rollback condition appears at any checkpoint, disable the flag and redeploy immediately.

- [ ] **Step 3: Verify final Git and deployment state**

```powershell
git status --short
git rev-list --left-right --count origin/main...HEAD
npx vercel inspect https://www.secwyn.com
```

Expected: clean working tree, `0 0` divergence, production deployment `Ready`, and `www.secwyn.com` attached.

- [ ] **Step 4: Report exact completion boundary**

Report:

- code commits and changed files;
- test/build counts and warnings;
- production deployment ID and alias;
- exact metadata observed on the no-charge Live checkout;
- Vercel/Supabase results at 0/5/15/30 minutes;
- whether rollback occurred;
- SES and Safety Autopause remain off;
- real paid-webhook propagation, credit-cycle behavior, and referral behavior remain unverified until an explicitly authorized user-completed Live payment.
