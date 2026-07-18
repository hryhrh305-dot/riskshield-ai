# Secwyn Pricing Entitlement Matrix

Date: 2026-07-18
Legend: `—` unavailable; `Custom` requires an agreed Business arrangement.

## Catalog generation contract

| Generation | Starter | Growth | Scale | Scale referral | Evidence |
|---|---:|---:|---:|---:|---|
| Legacy monthly | $49 / 500 | $249 / 2,500 | $1,499 / 15,000 | 1,500 | `src/lib/billing-catalog.ts` |
| Legacy annual | $499 / 500 per service month | $2,499 / 2,500 per service month | $14,999 / 15,000 per service month | 1,500 | `src/lib/billing-catalog.ts` |
| Premium V2 monthly | $199 / 500 | $999 / 2,500 | $3,999 / 10,000 | 1,000 | `src/lib/billing-catalog.ts` |
| Premium V2 annual | $2,189 / 500 per service month | $10,989 / 2,500 per service month | $43,989 / 10,000 per service month | 1,000 | `src/lib/billing-catalog.ts` |

Premium V2 annual credits are issued monthly. Annual pricing is billed annually in USD and represents 12 months for the price of 11. Scale annual remains contact-only. Pricing cards, highlights, and the Included checks comparison row all read the server-selected catalog. Catalog selection and Product IDs remain server-side.

## Current public capability matrix

| Feature | Free | Starter | Growth | Scale | Business | Actual implementation / minimum plan | Evidence file | Production status | Final public wording |
|---|---|---|---|---|---|---|---|---|---|
| Included checks | 50 one-time | 500/mo | 2,500/mo | Legacy 15,000; V2 10,000 | Custom | Catalog-selected capacity | `billing-catalog.ts`, pricing catalog API | Live | Included checks |
| Daily contact processing limit | 5/day | 300/day | 1,500/day | 8,000/day | Custom | Cost-unit daily cap | `plans.ts`, `cost-control.ts` | Live | Daily contact processing limit |
| Single-contact checks | Included | Included | Included | Included | Included | Authenticated single check | `plan-entitlements.ts`, `/api/web-risk` | Live | Single-contact checks |
| List audit workflow | — | Included | Included | Included | Included | Bulk entitlement Starter+ | `plan-entitlements.ts`, `/api/bulk-check` | Live | List audit workflow |
| Maximum Web contacts per run | 1 | 500 | 5,000 | 5,000 | 5,000 | Plan cap plus route hard cap | `plans.ts`, `/api/bulk-check` | Live | Maximum Web contacts per run |
| CSV/TXT/XLSX upload | — | Included | Included | Included | Included | Browser parsing plus Starter+ bulk gate | `bulk-check/page.tsx`, `bulk-web-batching.ts` | Live | CSV / TXT / XLSX upload |
| CSV/XLSX result export | — | Included | Included | Included | Included | Export entitlement Starter+ | `plan-entitlements.ts`, `export/csv.ts` | Live | CSV / XLSX result export |
| Recent audit history | Included | Included | Included | Included | Included | Stored audit history surface | `/api/audits`, `pre-send/page.tsx` | Live | Recent audit history |
| Email syntax and format | Included | Included | Included | Included | Included | Core risk engine | `risk-engine.ts`, `decision-integrity.ts` | Live | Email syntax and format |
| Disposable email detection | Included | Included | Included | Included | Included | Core risk engine | `risk-engine.ts` | Live | Disposable email detection |
| Role-based and suspicious patterns | Included | Included | Included | Included | Included | Core risk engine | `risk-engine.ts` | Live | Role-based and suspicious address patterns |
| Suspicious domains and TLDs | Included | Included | Included | Included | Included | Core risk engine | `risk-engine.ts` | Live | Suspicious domains and TLDs |
| MX mail-server evidence | Standard | Standard | Extended | Extended | Custom | MX is core; deep domain work starts Growth | `risk-engine.ts`, `plans.ts` | Live | MX mail-server evidence |
| SMTP mailbox response | — | Included | Included | Included | Included | Visible from Starter | `plans.ts`, `risk-engine.ts` | Live | SMTP mailbox response |
| Mailbox full/temp rejection | — | Included | Included | Included | Included | SMTP evidence from Starter | `plans.ts`, `risk-engine.ts` | Live | Mailbox full / temporary rejection |
| Catch-all detection | — | Included | Included | Included | Included | Visible from Starter | `plans.ts`, `risk-engine.ts` | Live | Catch-all domain detection |
| SPF/DMARC/DKIM | — | Scored internally | Included | Included | Included | Visibility grows at Growth | `risk-engine.ts`, `plans.ts` | Live | SPF / DMARC / DKIM checks |
| Domain age/new-domain risk | — | — | Included | Included | Included | Deep detection Growth+ | `plans.ts`, `/api/bulk-check` | Live | Domain age and new-domain risk |
| Blacklist matching | Risk signal | Included | Included | Included | Included | Core engine plus authenticated management | `blacklist.ts`, `risk-engine.ts` | Live | Blacklist matching |
| Detailed evidence/risk factors | — | — | Included | Included | Included | Client-ready detailed report Growth+ | `plan-entitlements.ts`, `plans.ts` | Live | Detailed evidence and risk factors |
| Recommended actions | — | Recommended action | Detailed actions | Detailed actions | Custom | Canonical decision output; detail gated | `list-audit.ts`, `plans.ts` | Live | Recommended actions |
| Domain health context | — | — | Included | Included | Included | Deep domain context Growth+ | `plans.ts`, `risk-engine.ts` | Live | Domain health context |
| IP geolocation/network context | — | — | Included | Included | Included | Advanced IP visibility Growth+ | `plans.ts`, `risk-engine.ts` | Live | IP geolocation and network context |
| Proxy/VPN detection | — | — | Included | Included | Included | Advanced IP visibility Growth+ | `plans.ts`, `risk-engine.ts` | Live | Proxy / VPN detection |
| Hosting/datacenter detection | — | — | Included | Included | Included | Advanced IP visibility Growth+ | `plans.ts`, `risk-engine.ts` | Live | Hosting / datacenter IP detection |
| High-risk geography signals | — | — | Included | Included | Included | Advanced IP visibility Growth+ | `plans.ts`, `risk-engine.ts` | Live | High-risk geography signals |
| Email + IP combined scoring | — | — | Included | Included | Included | Combined risk route and Growth+ visibility | `/api/v1/risk/check`, `plans.ts` | Live | Email + IP combined scoring |
| API access | — | — | Standard | Scale limits | Custom | Growth+ entitlement and route gate | `plan-entitlements.ts`, `api-auth.ts` | Live | API access |
| Google Sheets | — | — | Included | Included | Custom | Growth+ API entitlement | `plan-entitlements.ts`, `/api/v1/email/batch-check` | Live | Google Sheets integration |
| Pre-send workflow | — | — | Included | Included | Custom | Growth+ API workflow | `/api/v1/pre-send/check`, `plan-entitlements.ts` | Live | Pre-send workflow |

## Removed from the current entitlement table

Extended history retention, campaign reporting dashboard, risk settings as a paid-plan entitlement, blacklist management as a paid-plan entitlement, webhook delivery as a packaged entitlement, multiple-key permissions, custom rules/allowlists, team roles, priority queue, implementation assistance, SLA/procurement, and white-label reports were removed. Their prior labels did not have a complete feature → gate → route → output → test evidence chain suitable for a current public entitlement claim. Their removal changes copy only; no capability was deleted.

## Credit and checkout truths

- Cached results consume the same audit credit as a newly computed result.
- Downloading or printing an already completed result consumes no additional audit credit.
- Free has 50 one-time checks and no list upload, API, or Google Sheets access.
- Premium V2 administrator purchase buttons remain locked while Test Checkout is disabled.
- Legacy Live checkout behavior is unchanged.
