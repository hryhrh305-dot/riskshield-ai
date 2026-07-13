# Secwyn E8 Operator Guide

E8 is an additive, feature-flagged attribution and observability layer. It does not send email, change risk scoring, deduct credits, award referrals, modify authentication email, or change Creem billing behavior. Every rollout flag is off by default, and the outreach global kill switch is on by default.

## Safety boundary

- The migration creates eight new service-role-only tables. It does not alter existing tables, triggers, RPCs, credits, referrals, plans, bulk checks, Google Sheets, auth, or risk scoring.
- Supabase Auth, password-reset email, verification email, and transactional billing email must never use the E8 suppression list.
- `hard_bounce`, `complaint`, and explicit `unsubscribe` create permanent marketing suppression records. Manual/provider rejections can be added by an authorized operator using the same hashed identity model.
- Internal auto-pause defaults are a per-`batch_id` hard-bounce rate of 2% after at least 100 attempts and a rolling campaign 24-hour complaint-per-delivery rate of 0.05% after at least 100 deliveries. Missing `batch_id` never triggers the batch hard-bounce pause. These are internal safety thresholds, not public deliverability claims.
- `OUTREACH_GLOBAL_KILL_SWITCH=true` is the highest-priority state. E8 contains no sending path, but every future sender must require this value to be explicitly `false` before dispatch.
- Never log SNS bodies, raw webhook payloads, recipient addresses, CID tokens, signatures, signing certificates, or HMAC keys.

## Local and Preview preparation

1. Keep all rollout flags `false` and the global kill switch `true`.
2. Generate independent server-only secrets of at least 32 random bytes for `E8_CID_HMAC_KEY`, `E8_ANON_HMAC_KEY`, and `E8_IDENTITY_HMAC_KEY`. Keep the prior CID key in `E8_CID_HMAC_PREVIOUS_KEY` during rotation.
3. Apply `supabase/migrations/202607130010_e8_observability_backbone.sql` only to an isolated local database or approved Supabase staging branch.
4. Run the E8 tests, the complete test suite, the changed-file lint check, and `npm run build`.
5. Deploy only a non-production Preview branch. Confirm that existing signup, password reset, single check, bulk check, credits, referrals, checkout, webhook, API, and Google Sheets behavior is unchanged while all E8 flags are off.
6. Enable one E8 flag at a time in Preview. Do not copy production secrets or customer payloads into Preview.

## AWS SES Configuration Set

These steps are manual AWS console or infrastructure-as-code operations. They are not performed by this repository.

1. In the approved AWS region, create a dedicated SES Configuration Set for Secwyn outreach telemetry.
2. Create an event destination that publishes Send, Delivery, Bounce, Complaint, Reject, Delivery Delay, Open, Click, and Subscription events to a dedicated SNS Topic.
3. Attach the Configuration Set only to an approved marketing/outreach sender. Do not attach it to Supabase Auth or transactional email.
4. Record the Configuration Set name as `AWS_SES_CONFIGURATION_SET`. E8 currently has no sender, so this value is documentation for the future approved sending system.
5. Keep SES account-level suppression and reputation monitoring enabled. E8 suppression is an additional application safety layer, not a substitute for AWS controls.

## SNS Topic and subscription

1. Create a dedicated SNS Topic in the same approved account/region and restrict the publish policy to the SES service and expected source account/configuration set.
2. Add the exact Topic ARN to `AWS_SNS_ALLOWED_TOPIC_ARNS`. Multiple exact ARNs may be comma-separated; wildcards are not accepted.
3. Create an HTTPS subscription targeting `https://<approved-host>/api/e8/ses/events` only after Preview/Staging validation.
4. E8 validates Signature Version 2 with SHA-256, the exact Topic ARN, an HTTPS Amazon SNS certificate URL, certificate path, payload size, and the SNS canonical string.
5. Subscription confirmation is intentionally not automatic. The endpoint returns `manual_required`; an authorized operator must review the Topic ARN and confirmation request, then confirm it in AWS. Never build a generic server-side GET of `SubscribeURL`.
6. Test with signed AWS notifications or controlled fixtures in Staging. Duplicate and out-of-order notifications must remain idempotent.

## Creem attribution metadata

- With `CREEM_ATTRIBUTION_METADATA_ENABLED=false`, checkout metadata remains the existing `user_id`, `plan`, `billing_interval`, and `source` payload.
- When enabled, the server may add only opaque `checkout_request_id`, `attribution_id`, and optional `campaign_id`. It never adds email, raw CID, UTM values, cookies, HMAC values, or browser fingerprints.
- The payment webhook continues verifying `creem-signature` against the raw body before any E8 work.
- The `subscription_events` insert is a best-effort sidecar. Its failure must not change the webhook response or existing payment, credits, subscription, and referral effects.
- Provider event ID is the primary idempotency key; a versioned SHA-256 raw-body digest is the fallback. Unknown, unmatched, and terminal events remain available for reconciliation without granting credits or referrals.

## Supabase migration procedure

1. Review the generated SQL and verify that it contains only the eight E8 tables, indexes, RLS enablement, revokes, and service-role grants.
2. Apply it first to local Postgres, then an approved Supabase Staging branch.
3. Check all eight tables exist, RLS is enabled, `anon`/`authenticated` cannot read or write, and `service_role` can perform required operations.
4. Confirm duplicate `source + idempotency_key` inserts do not create extra rows.
5. Confirm `raw_payload` columns are inaccessible to client roles.
6. Production migration requires a separate explicit authorization and a current backup/rollback review. Do not run the migration from a developer workstation without that approval.

## Staged flag order

1. Keep `OUTREACH_GLOBAL_KILL_SWITCH=true` throughout observability rollout.
2. Enable `OUTREACH_OBSERVABILITY_ENABLED` in Staging.
3. Enable `ACQUISITION_ATTRIBUTION_ENABLED`; verify valid, invalid, expired, and tampered CIDs never affect signup.
4. Enable `OUTREACH_DASHBOARD_ENABLED` for `ADMIN_EMAILS`; verify non-admins cannot access it and empty data renders safely.
5. Enable `CREEM_ATTRIBUTION_METADATA_ENABLED` with Creem test mode only; verify the flag-off contract and optional opaque metadata.
6. Configure exact SNS Topic ARN and identity HMAC, then enable `SES_EVENT_INGESTION_ENABLED` in Staging.
7. Enable `OUTREACH_SAFETY_AUTOPAUSE_ENABLED` only after signed notification, suppression, duplicate, and threshold fixtures pass.
8. Production flags and production migration require separate user authorization. No real campaign or real payment is part of E8 verification.

## Public endpoint firewall gate

The attribution and product-event endpoints enforce signed anonymous cookies, exact same-origin requests, strict bodies, and a light in-process rate limit. A Vercel instance-local counter is not a distributed production control. Before Production enablement, HumanOps must configure Vercel Firewall rate-limit rules for `/api/e8/attribution/session` and `/api/e8/product-events`, verify the rules in Preview/Staging, document the thresholds, and keep the E8 flags off until that gate is approved.

## Data dictionary and 90-day raw retention

- `identity_hash` is a keyed HMAC of normalized email and is used only for marketing suppression. Raw email may occur inside provider `raw_payload`; it is service-role-only and never logged.
- CID and anonymous cookies contain random identifiers, version, expiry, and HMAC only. They contain no email, UTM values, browser fingerprint, or auth credential.
- Attribution/product tables retain opaque IDs and allowlisted campaign dimensions. Subscription events retain nullable reconciliation and financial fields from signed Creem webhooks.
- `email_events.raw_payload` and `subscription_events.raw_payload` expire after 90 days. Audit rows, hashes, types, timestamps, and reconciliation fields remain.
- Schedule `select public.purge_e8_expired_raw_payloads();` from a service-role-only, approved Supabase scheduled job. Verify the returned updated-row count and confirm expired payloads equal `{}` while audit rows still exist. Never expose this function to `anon` or `authenticated`.
- To pause retention cleanup, disable the scheduler; do not drop audit tables. To roll back a faulty cleanup deployment, restore from the approved backup and correct it with a new forward migration. Production scheduling and rollback require separate authorization.

## Verification checklist

- Flags unset: all E8 collection/dashboard/metadata ingestion is disabled and kill switch is on.
- CID: valid current/previous keys work; invalid, expired, malformed, or tampered tokens are ignored safely.
- URL cleanup removes only `cid`; valid UTM parameters remain.
- Product events enforce name, UUID, property, and body-size allowlists.
- SNS rejects invalid signatures, wrong Topic ARN, Signature Version 1, unsafe certificate hosts/paths, oversized bodies, and missing fields.
- Confirmation messages never trigger an outbound HTTP request.
- SES hard bounce, complaint, and unsubscribe create permanent hashed suppressions; soft bounce does not.
- Creem duplicate events create one sidecar row and never duplicate the existing subscription grant or referral logic.
- Dashboard is read-only, admin-gated, flag-gated, filterable, and safe with zero data or missing Preview migration.
- Existing protected regression and build checks remain green.

## Rollback

1. Set all E8 rollout flags to `false` and `OUTREACH_GLOBAL_KILL_SWITCH=true`. This is the primary rollback and requires no schema change.
2. Disable the SES event destination or SNS subscription if ingestion itself is unhealthy. This does not affect Auth or transactional email when the separation rule above is followed.
3. Remove E8 metadata flag before changing Creem configuration. Existing checkout/webhook behavior continues with the original metadata.
4. Preserve the eight tables for audit/reconciliation. Do not drop them during an incident. A destructive schema rollback requires a separately reviewed forward migration and explicit production authorization.

E8 does not make Secwyn production-ready by itself. Production enablement remains a separate approval gate with AWS, Supabase, Creem, Vercel, security, privacy, and business-owner review.
