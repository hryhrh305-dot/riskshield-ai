# Secwyn E8 Cutover Phase A — Known Limitations

Verified: 2026-07-16 (Asia/Shanghai)

## Blocking external-evidence gaps

1. Provider-side coupon scope was not inspectable. V2 Annual exclusion from every existing Creem promotion is not proven.
2. New Legacy checkout during the Preview rollback failed because matching Legacy Test Products were not staged.
3. Creem's signed return query did not validate against the documented HMAC construction or configured Test credentials. Webhook activation passed, verification remained fail-closed, and temporary diagnostics were removed.

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

Preview acceptance used an ephemeral local Supabase staging stack and tunnel. It was suitable for Phase A evidence, not a durable shared Staging environment. After evidence collection, branch-scoped write credentials were sealed with fail-closed placeholders; authenticated Preview acceptance cannot be resumed without explicitly staging a new isolated environment.
