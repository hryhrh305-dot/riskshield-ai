# Secwyn Copy Replacement Log

Date: 2026-07-18

| File | Page/surface | Old copy | New copy | Reason | Evidence |
|---|---|---|---|---|---|
| `HomePageClient.tsx` | Header, mobile menu, hero, final CTA | Audit 50 Contacts Free | Start with 50 Free Checks | Free is a one-time single-contact allowance, not a free list audit | `plans.ts`, `plan-entitlements.ts` |
| `HomePageClient.tsx` | FAQ | 50 free audits | 50 free checks | Normalize the free mechanism | `plans.ts` |
| `HomePageClient.tsx` | ICP/FAQ/evidence list | Signup and form-abuse future direction | Removed | Not a released production workflow or current ICP | No production route/entitlement |
| `pricing/page.tsx` | Intro | 50 one-time contact audits | 50 one-time checks | Avoid implying free batch audit | `plan-entitlements.ts` |
| `pricing/page.tsx` | Intro | Less than the cost of one wasted campaign launch | Choose capacity based on contacts audited per service month | Remove an unproved savings claim | Catalog contract |
| `pricing/page.tsx` | Comparison | Audit runs per day | Daily contact processing limit | Values count contacts/cost units, not runs | `plans.ts`, `cost-control.ts` |
| `pricing/page.tsx` | Comparison | MX mail-server verification: Starter Deep | MX mail-server evidence: Starter Standard | Deep detection starts at Growth | `plans.ts` |
| `pricing/page.tsx` | Comparison | Detailed risk factors | Detailed evidence and risk factors | Make the output boundary explicit | `plan-entitlements.ts` |
| `pricing/page.tsx` | Comparison | Recommended actions and remediation | Recommended actions | Do not promise remediation service | `list-audit.ts` |
| `pricing/page.tsx` | Comparison | Company health score | Domain health context | Avoid positioning Secwyn as company intelligence | `plans.ts`, `risk-engine.ts` |
| `pricing/page.tsx` | Comparison | Higher limits | Scale limits | Remove an undefined comparative claim | Catalog/plan gates |
| `pricing/page.tsx` | Comparison | Coming soon and unproved plan-gated rows | Removed | Not current entitlements or missing the advertised paid-plan gate | Missing complete evidence chains |
| `pricing/page.tsx` | Comparison help | Roadmap/Coming soon legend | Current-capability statement | Table now contains only current or agreed custom capabilities | Entitlement audit |
| `pricing/page.tsx` | Canary lock | Test checkout not enabled… | Administrator test checkout is currently disabled… | Clear, professional administrator-only state | C1 purchase mode contract |
| `pricing/page.tsx` | Loading states | Loading... / Redirecting... | Loading… / Redirecting… | Editorial consistency | Writing guidelines |
| `dashboard/page.tsx` | Risk settings | BLOCK / Block | Suppress | Use the public decision language | `decision-integrity.ts` |
| `risk-check/page.tsx` | Result | Internal ALLOW/BLOCK | SEND/SUPPRESS | Keep internal codes out of customer display | `publicDecisionLabel` |
| `risk-check/page.tsx` | Evidence | Email Deliverability / Inbox Probability | Mailbox Evidence / Mailbox Evidence Status | Avoid delivery and inbox claims | Evidence contract |
| `bulk-check/page.tsx` | Results/exports | Internal ALLOW/BLOCK | SEND/SUPPRESS | Cross-surface public decision parity | `publicDecisionLabel` |
| `pre-send/page.tsx` | History/results | Blocked / internal decision | Suppressed / public decision | Cross-surface public decision parity | `publicDecisionLabel` |
| `AuditReportPreview.tsx` and `report-format.ts` | HTML/PDF/report preview | Internal ALLOW/BLOCK | SEND/SUPPRESS | Client-ready report consistency | Report formatter |
| `docs/page.tsx` | API intro/examples | Valid/AI/internal-decision-led copy | Evidence, audit queue, reason, action | Match current response contract without unproved AI claims | Canonical decision adapter |
| `pre-send/layout.tsx` | Metadata | Campaign readiness decisions | Approval decisions | Avoid the removed readiness-score concept | Current product positioning |

No Product ID, secret, allowlist email, Supabase URL, or payment credential is recorded in this log.
