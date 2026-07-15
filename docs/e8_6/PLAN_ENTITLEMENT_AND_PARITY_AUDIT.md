# Secwyn E8.6 Plan Entitlement and Parity Audit

Date: 2026-07-15
Repository: `D:/ai-saas-mvp`
Baseline: `3ee2c1cebf238dbe86d0cc05763328b651bff090`

## Canonical plan contract

| Plan | Credits | Single Web | Bulk/List Audit | Basic Report/Export | Client-ready/Readiness/Acceptance | API | Google Sheets | Custom |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| Free | 50 one-time | Allow | Deny | Deny | Deny | Deny | Deny | Deny |
| Starter | 500/month | Allow | Allow | Allow | Deny | Deny | Deny | Deny |
| Growth | 2,500/month | Allow | Allow | Allow | Allow | Allow | Allow | Deny |
| Scale | 15,000/month | Allow | Allow | Allow | Allow | Allow | Allow | Deny |
| Business | Contract | Allow | Allow | Allow | Allow | Allow | Allow | Contract-only |

Top-up credits add usable quantity only. They do not change the effective plan or unlock Bulk, API, Sheets, report, export, or custom capabilities.

Paid plan access requires an active subscription. A cancelled subscription keeps access only until its paid period end. Inactive, expired, past-due, and paused subscriptions resolve to Free feature entitlements. Business access remains contract-backed and must be represented by an active profile/subscription state.

## Gate locations

| Capability | Client gate | Server gate | Result |
| --- | --- | --- | --- |
| Single Web Check | `src/app/(dashboard)/risk-check/page.tsx` login flow | `src/app/api/web-risk/route.ts` session auth and server credit consumer | Authenticated accounts; Free 50 supported |
| Bulk Web Audit | `src/app/(dashboard)/bulk-check/page.tsx` plan copy | `src/app/api/bulk-check/route.ts` `getPlanEntitlements().bulkWebAudit` before `consumeLegacyCredits` | Starter+ only |
| Basic report/export | Bulk page export controls | Same Starter+ bulk route; no standalone bypass route | Starter+ only |
| Client-ready/Readiness/Acceptance | Bulk report component | Growth+ result visibility from canonical plan/entitlement contract | Growth+ |
| API key creation | `src/app/(dashboard)/dashboard/page.tsx` shared entitlement check | API routes independently reject non-Growth+ keys; a key alone grants no feature access | Growth+ effective plan |
| API single/batch | Docs and Dashboard plan copy | `src/lib/cost-control.ts`, `src/app/api/v1/email/check/route.ts`, `src/app/api/v1/risk/check/route.ts`, `src/app/api/v1/email/batch-check/route.ts` | Growth/Scale/Business only |
| Google Sheets | Dashboard and `src/app/docs/google-sheets/page.tsx` | `src/app/api/v1/email/batch-check/route.ts`, same API-key and entitlement gate | Growth/Scale/Business only |
| Business CTA | Pricing/Dashboard/report CTA | No false feature unlock | Contact support / run another audit |

## Cross-surface result contract

`src/lib/decision-contract.ts` is the additive canonical contract. The active Single, Bulk, API, Sheets response, and report/export paths use the same `attachCanonicalDecisionResult` adapter. Existing `risk_score`, `risk_level`, and `decision` fields remain for compatibility.

Canonical fields include normalized email, base score, final decision/code, confidence, primary reason code/text, evidence, limitation, action, explanation, disposable/role/catch-all/MX state, inbox/bounce/reputation state, reserved/typo correction, engine/snapshot version, and audit timestamp.

Google Sheets consumes the server response and does not calculate a separate final decision. Web batch merging re-applies the same canonical adapter defensively to cached legacy rows.

## Conflicts found and fixed

- `tempmail.com` was missing from the trusted disposable source even though the domain could also appear in blacklist evidence.
- Provider-typo priority was below disposable; it now remains the primary reason while the decision stays BLOCK.
- Role-based detection did not canonicalize `+tag` and omitted required operational prefixes.
- Top Risk Reasons counted multiple secondary signals per result; Top Decision Drivers now counts exactly one canonical primary reason per result.
- Risk Score/Risk Level labels obscured hard overrides; user-facing labels now distinguish Base Signal Score and Final Decision.
- Boolean cells used icons without Yes/No/Unknown text; Web and Sheets now preserve explicit tri-state meaning.
- API batch access used plan alone without fully resolving cancelled/expired/past-due state.
- Dashboard API-key controls used raw plan access instead of the shared entitlement contract.
- Public copy contained stale Free preview, legacy 1,000-request, and score-60 wording.
- Waste output called contacts “credits saved”; it now exposes campaign sends avoided, assumptions, formula, and an estimate-only disclaimer.

## Files used for the fix

- `src/lib/plan-entitlements.ts`
- `src/lib/decision-contract.ts`
- `src/lib/email-classification.ts`
- Existing decision, audit, plan, route, UI, report, export, and Google Sheets adapter files listed by the E8.6 diff
- `tests/e8-6-cross-surface-parity.test.ts`
- `tests/e8-6-plan-entitlements.test.ts`

## Protected modules not modified

- Credits ledger, grants, reservation/finalize, idempotency, and accounting code
- Supabase schema, migrations, RLS, RPCs, or production data
- Creem products, prices, payment/webhook behavior, or secrets
- Auth configuration and password reset behavior
- Referral attribution, review, reward, or expiry behavior
- E8 attribution/SES/SNS/safety modules and flags
- Dependencies, environment variables, Vercel project configuration, DNS, or Google Sheets publication state
- Risk score point values and 0–25 / 26–65 / 66–100 boundaries

## Residual operational limits

- Google Sheets code contract is testable locally, but the add-on is not published by this task.
- No real production credits are consumed for E8.6 verification.
- No real mailbox/SMTP control group is introduced.
- E8 external SES/SNS safety-chain acceptance remains separate and incomplete.
