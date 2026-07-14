# Creem Live Attribution Metadata — Minimal Safe Enablement Design

## Goal

Enable E8 attribution metadata for new Creem Live checkout sessions while preserving the existing Secwyn payment, subscription, credit, refund, and referral behavior. Detect checkout or E8 sidecar failures quickly enough to disable the feature flag before broader customer impact.

## Locked boundaries

- Keep Creem in Live Mode and keep the existing API key, webhook secret, product IDs, prices, success URL, and customer portal unchanged.
- Do not change plans, monthly or yearly credit grants, referral rewards, payment fulfillment, webhook signature verification, or billing event handling.
- Do not change the database schema or run a migration.
- Keep `SES_EVENT_INGESTION_ENABLED=false` and `OUTREACH_SAFETY_AUTOPAUSE_ENABLED=false`.
- Keep `OUTREACH_GLOBAL_KILL_SWITCH=true`.
- Use `CREEM_ATTRIBUTION_METADATA_ENABLED` as the primary rollback switch for all newly created checkout sessions.

## Metadata contract

The legacy checkout metadata remains:

- `user_id`
- `plan`
- `billing_interval`
- `source`

When the feature flag is enabled and the authenticated user has a valid bound attribution record, add only:

- `checkout_request_id`
- `attribution_id`
- optional `campaign_id`

Do not send `prospect_id`, `outreach_message_id`, email, raw CID, UTM values, cookies, HMAC values, IP addresses, or browser fingerprints to Creem as E8 metadata.

When attribution is absent, invalid, timed out, or not bound to the authenticated user, send the exact legacy metadata shape. Attribution lookup remains best-effort and must not block checkout.

## Minimal implementation

1. Narrow `buildCreemCheckoutMetadata` and its attribution input type to the approved fields.
2. Keep the existing 500 ms best-effort attribution lookup and existing checkout request unchanged.
3. Add focused contract tests for flag-off, flag-on without attribution, flag-on with attribution, and the forbidden-field list.
4. Add sanitized operational warnings at the two currently hard-to-see failure points:
   - an enhanced Creem checkout request is explicitly rejected;
   - the post-webhook E8 `subscription_events` sidecar fails or times out.
5. Logs may contain only status, event type, a non-sensitive request ID, and a short error code. They must not contain request bodies, webhook bodies, metadata objects, emails, Creem signatures, cookies, CID values, or secrets.

No automatic second checkout request will be added. Retrying after an ambiguous network result could create duplicate Live checkout sessions. An explicit failure instead triggers the feature-flag rollback procedure.

## Tests and pre-production gate

Before changing the production flag:

1. Run the focused E8 tests.
2. Run the complete test suite.
3. Run the production build.
4. Confirm the Git diff touches only the approved E8 metadata, webhook diagnostic, tests, and this design/plan documentation.
5. Deploy the code with `CREEM_ATTRIBUTION_METADATA_ENABLED=false`.
6. Verify homepage, pricing, login, password reset, dashboard authentication redirect, checkout creation, and the signed webhook rejection path.
7. Create one Live checkout from the internal test account without completing payment. Confirm the legacy checkout path still returns a valid Creem URL.

Creating a checkout does not charge the user. No real payment is authorized by this design.

## Controlled Live enablement

1. Record the current production deployment ID and current flag state.
2. Set `CREEM_ATTRIBUTION_METADATA_ENABLED=true` in Vercel Production.
3. Redeploy the already-tested commit without additional code changes.
4. Establish a valid bound E8 attribution session for the internal test account.
5. Create exactly one attributed Live checkout without completing payment.
6. Retrieve the checkout from Creem by checkout ID and verify:
   - mode is `prod`;
   - product ID, price selection, customer, success URL, and billing interval are unchanged;
   - metadata contains the four legacy fields plus only the approved E8 fields;
   - no forbidden field is present.
7. Verify one matching `checkout_started` product event exists and the pending `payments` record uses the expected user, product, plan, amount, and currency.

## Immediate detection and review

### First 30 minutes

Check immediately after the controlled checkout, then at 5, 15, and 30 minutes:

- Vercel production logs for `/api/create-checkout` non-2xx responses, `Checkout error`, `e8-creem checkout-rejected`, and `e8-creem subscription-sidecar-failed`.
- Creem Live dashboard/API for checkout mode, product, status, and exact metadata.
- Supabase for the expected `product_events` and `payments` rows, without inspecting or printing customer secrets.
- Public smoke checks for homepage, pricing, login, reset-password, and the unauthenticated bulk-check redirect.

### Ongoing review

For the next 24 hours, review production logs and E8 admin counts at least once after the first real customer checkout and once after the first signed Creem payment webhook. A future scheduled monitor may be added separately; this release does not introduce a new scheduler or alerting service.

### What can be verified without payment

- Creem accepts the Live checkout request.
- The returned checkout is a production checkout.
- Product selection and Checkout metadata are correct.
- Secwyn records `checkout_started` and the pending payment row correctly.

### What requires a real payment

- Creem propagates the new metadata through a signed production webhook.
- `subscription_events` receives the attribution fields.
- Existing subscription, credit-cycle, and referral effects remain correct on a real paid event.

The real-payment verification requires separate explicit authorization and a user-completed payment. Until then, report the webhook attribution loop as unverified rather than production-proven.

## Immediate rollback conditions

Disable `CREEM_ATTRIBUTION_METADATA_ENABLED` and redeploy immediately if any of these occurs:

- the controlled attributed checkout returns non-2xx or no valid checkout URL;
- Creem returns a non-production checkout or a wrong product, amount, interval, customer, or success URL;
- metadata is missing required legacy fields or contains forbidden fields;
- `/api/create-checkout` begins returning new 5xx responses;
- a signed payment webhook changes the established subscription, credit, refund, or referral result;
- the E8 sidecar throws repeatedly or causes webhook latency/error behavior;
- any secret, email, signature, raw webhook body, cookie, CID, or HMAC value appears in logs.

Rollback consists only of setting the metadata flag to `false` and redeploying. Existing Checkout sessions retain metadata already sent to Creem, but all new checkouts return to the legacy four-field metadata contract. Preserve E8 audit tables for reconciliation; do not delete data during rollback.

## Acceptance criteria

- All focused and full tests pass and the production build succeeds.
- Flag-off checkout behavior is unchanged after deployment.
- One attributed Live checkout is created without payment and passes the exact metadata review.
- No new production error appears during the initial 30-minute observation window.
- SES and Safety Autopause remain disabled.
- The final report clearly separates checkout-level verification from the still-pending real-payment webhook verification.
