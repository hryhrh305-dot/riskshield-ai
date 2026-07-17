# Secwyn E8.8R Production Canary Phase B

Status: local implementation pending Production HumanOps environment gate.

## Scope

- Premium V2 pricing is returned only when a Supabase-authenticated server session has a verified email in the server-only allowlist.
- Everyone else receives the Legacy catalog and existing Live checkout availability.
- Premium V2 checkout is locked during Phase B. Scale annual remains contact-led.
- No Product ID, allowlist value or administrator identity is returned to the client.

## Production environment gate

Set only in the Vercel Production environment:

- `SECWYN_ADMIN_V2_CANARY_ENABLED=true`
- `SECWYN_V2_CANARY_EMAILS=<comma-separated email addresses>`

The flag accepts only exact lowercase `true`. The allowlist must contain valid email addresses separated by commas. Invalid, empty or missing configuration fails closed to Legacy.

Do not set these values in Preview or Development. Do not configure `SECWYN_ADMIN_TEST_CHECKOUT_ENABLED` in Phase B.

## Checkout boundary

- Legacy users retain the existing Live checkout route and server-derived Product mapping.
- An allowlisted administrator receives HTTP 409 with `V2_CANARY_CHECKOUT_DISABLED` from the checkout route.
- V2 buttons show `Checkout validation pending`; no Live or Test checkout is created.
- Scale annual continues to show `Contact sales`.

## Rollback

Set `SECWYN_ADMIN_V2_CANARY_ENABLED=false` and redeploy. All visitors then receive Legacy pricing; no database, Product mapping or payment rollback is required.
