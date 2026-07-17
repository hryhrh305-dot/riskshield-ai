# Secwyn E8.8R Pricing Generation Contract

Status: implemented in the existing dual catalog; re-audited 2026-07-17.

| Generation | Plan | Monthly / annual USD | Credits per service month | Referral snapshot |
|---|---|---:|---:|---:|
| Legacy | Starter | 49 / 499 | 500 | 50 |
| Legacy | Growth | 249 / 2,499 | 2,500 | 250 |
| Legacy | Scale | 1,499 / 14,999 | 15,000 | 1,500 |
| Premium V2 | Starter | 199 / 2,189 | 500 | 50 |
| Premium V2 | Growth | 999 / 10,989 | 2,500 | 250 |
| Premium V2 | Scale | 3,999 / 43,989 | 10,000 | 1,000 |

- Product ID plus catalog generation is the entitlement snapshot. V2 must never overwrite an active Legacy subscription.
- Annual payment grants one service month at a time. Referral uses one service-month capacity once.
- V2 Starter/Growth annual may be self-serve only behind both server flags and complete mappings. V2 Scale annual remains contact-only.
- Unknown or duplicate Product IDs fail closed. The client cannot choose price, Product ID or generation.
- Free remains 50 one-time. API and Google Sheets remain Growth+; Web runs remain at most 5,000.
