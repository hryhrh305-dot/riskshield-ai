# Secwyn E8.8 Rollback

## Local rollback

Use a normal `git revert` of the E8.8 commit, then run the full tests and build. Do not reset, force-push or delete customer/ledger data.

## Future deployment rollback

1. Set `SECWYN_V2_ANNUAL_SELF_SERVE_ENABLED=false`.
2. Confirm Starter/Growth annual checkout is closed and Scale remains contact-led.
3. Set `SECWYN_PREMIUM_PRICING_V2_ENABLED=false`.
4. Confirm Legacy public Pricing and Checkout.
5. Keep every Legacy and V2 Product ID configured so Webhook and Dashboard can recognize existing subscribers.
6. Roll back to the previous READY Vercel deployment only if code rollback is required.
7. Revert the Git commit normally and verify Webhook, Credits, referral and Portal.

No database down migration exists or is required because E8.8 changes no schema. Never delete historical grants, payments, subscriptions or referral snapshots.
