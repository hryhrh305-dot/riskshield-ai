# Secwyn Production Premium V2 Rollback Operator Guide

Use this guide only when the public Premium V2 catalog or Live checkout path shows a P0/P1 regression.

## Preferred Configuration Rollback

1. In Vercel, open the Secwyn project.
2. Open **Settings → Environment Variables**.
3. In **Production** only, set:
   - `SECWYN_PREMIUM_PRICING_V2_ENABLED=false`
   - `SECWYN_V2_ANNUAL_SELF_SERVE_ENABLED=false`
4. Confirm `SECWYN_ADMIN_TEST_CHECKOUT_ENABLED=false`.
5. Redeploy the latest Ready Production source so the new environment snapshot is applied.
6. Verify `https://www.secwyn.com/api/pricing-catalog` reports:
   - generation `legacy`
   - purchase mode `live`
   - Starter $49 / 500
   - Growth $249 / 2,500
   - Scale $1,499 / 15,000
7. Verify the public Pricing page displays the same Legacy contract.

This rollback does not delete code, Product mappings, subscriptions, payments, credits, referrals, or Test Canary evidence.

## Deployment Rollback

If configuration rollback is insufficient:

1. Reassign the Production alias to the last known Ready deployment.
2. Keep both Premium V2 flags disabled.
3. Create a normal Git revert of the failing release commit.
4. Run the complete test and Production build gates.
5. Push the revert normally and verify the resulting deployment.

Do not use `reset`, `rebase`, force push, or destructive database rollback.

## Post-Rollback Verification

- Public Pricing is Legacy.
- Existing Legacy Live checkout still works.
- Scale annual remains contact-only only when Premium V2 is active; Legacy annual behavior is unchanged.
- Test Checkout is disabled.
- Test and Live billing stores remain isolated.
- No payment, subscription, credit grant, or referral record was deleted.
- Production logs contain no new P0/P1 errors.

## Escalation Conditions

Stop further rollout and investigate if any of these occur:

- displayed catalog and checkout generation differ;
- unknown or missing Live Product mapping;
- Test Product reaches the Live webhook;
- Live Product reaches the Test webhook;
- unexpected payment, subscription, credit, or referral delta;
- public response exposes provider identifiers or Secrets;
- repeated 5xx responses on Pricing, Checkout, Redirect, Webhook, or Portal routes.
