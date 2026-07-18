# Secwyn Final Test Payment Operator Guide

This guide is for one authorized Creem Test Mode acceptance payment only. Never use a real card or alter any Live Creem Product, key, webhook, or subscription.

## Readiness checklist

- Production deployment is Ready and uses the repaired Test webhook parser.
- `SECWYN_ADMIN_V2_CANARY_ENABLED` is true only for the server-side Canary allowlist.
- `SECWYN_ADMIN_TEST_CHECKOUT_ENABLED` is false before the acceptance window.
- Dedicated Test API key, Test webhook secret, and Test Product mappings are configured.
- Test webhook URL is exactly `https://www.secwyn.com/api/payment/webhook/creem-test-canary`.
- Live checkout remains available to non-Canary users.
- Pre-payment Test and Live aggregate snapshots have been recorded without exposing identifiers.

## One-payment sequence

1. Set `SECWYN_ADMIN_TEST_CHECKOUT_ENABLED` to exact lowercase `true` for Production and redeploy.
2. Sign in with the approved Canary administrator account.
3. Confirm the Premium V2 catalog is shown and select the single approved self-serve Test plan. Scale Annual remains contact-only.
4. Confirm the browser enters Creem Test Mode, then use only Creem's official Test payment method.
5. Return to the Secwyn billing result page. The page must not claim success from the redirect alone.
6. Wait for the authoritative Test webhook. The final page state must confirm the isolated Test payment, subscription, and evidence-only credit grant.
7. Immediately set `SECWYN_ADMIN_TEST_CHECKOUT_ENABLED` back to exact lowercase `false` and redeploy.
8. Confirm the Canary purchase button is locked again.

## Required evidence

- Exactly one new completed Test payment for the acceptance attempt.
- Exactly one active Test subscription.
- Exactly one first-service-month evidence-only Test credit grant.
- Exactly one planned-only Test referral snapshot, with the V2 plan reward contract.
- Duplicate Test webhook delivery does not create duplicate records.
- The Test grant is absent from the normal usable credit balance.
- The existing Live plan, Live subscription status, Live credits, Live payments, Live grants, and Live referrals are unchanged.
- Live checkout remains operational for a non-Canary user.
- Test Portal uses the Test API path; Live Portal remains unchanged.
- Production logs contain no 5xx, unknown Test Product, invalid environment, or Test/Live crossing error.

## Stop conditions

Stop without a second attempt if the checkout uses a Live Product, the amount or interval is wrong, the redirect is unverified, the webhook returns 4xx/5xx after the repaired deployment, any Live balance or entitlement changes, or more than one isolated grant is created. Keep Test Checkout disabled and preserve all evidence for diagnosis.
