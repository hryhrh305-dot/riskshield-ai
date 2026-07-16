# Secwyn E8 Cutover Phase A — Known Limitations

Verified: 2026-07-16 (Asia/Shanghai)

## Blocking external-evidence gaps

1. A new Legacy Growth Annual checkout passed during the Preview rollback, but the staged Legacy Test mappings remain incomplete: three monthly IDs were not found and Starter Annual opened a Scale-named product.
2. Creem's signed return query did not validate against the documented HMAC construction or either staged Test credential. Webhook activation passed, verification remained fail-closed, and temporary diagnostics were removed.

Provider-side coupon scope is no longer a blocker: HumanOps confirmed on 2026-07-16 that existing coupons do not stack onto V2 Annual Products.

## Known repository baseline

- Full ESLint: 111 errors and 39 warnings in the existing repository baseline.
- Full TypeScript check: existing errors across billing/referral/API/test types; broad remediation was out of scope.
- Next.js warns that the `middleware` file convention is deprecated.

## Test Mode / time limitations

- No natural twelve-month service lifecycle was observed.
- Refund, dispute, chargeback, past-due, cancellation, renewal, exact replay, and referral maturity are automated fixture/simulation evidence unless explicitly listed as real Test Mode checkout evidence.
- Live taxes, VAT, issuing-bank behavior, European payment rails, Live portal behavior, and real settlement remain untested.
- Portal cancellation was visible but not executed.
- No real referred Test Mode buyer was used, so real referral reward issuance was not observed.

## Environment limitation

Preview acceptance used an ephemeral local Supabase staging stack and tunnel. It was suitable for Phase A evidence, not a durable shared Staging environment. The disposable stack required test-only default role grants because the repository's historical root schema was not a complete Supabase local bootstrap. No repository migration or Production schema was changed. After evidence collection, branch-scoped write credentials were sealed with fail-closed placeholders; authenticated Preview acceptance cannot be resumed without explicitly staging a new isolated environment.
