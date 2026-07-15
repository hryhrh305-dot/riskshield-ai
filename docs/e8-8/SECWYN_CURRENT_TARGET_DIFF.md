# Secwyn E8.8 Current-to-Target Diff

| Area               | Current                                  | E8.8 target                                          | Change type      |
| ------------------ | ---------------------------------------- | ---------------------------------------------------- | ---------------- |
| Catalog            | One Legacy catalog                       | Legacy plus Premium V2                               | Additive         |
| Public mode        | No pricing generation flag               | Server-only V2 flag, false by default                | Additive         |
| Annual gate        | Product ID alone enables checkout        | V2 flag + annual flag + mapped ID                    | Hardening        |
| Scale annual       | Self-serve                               | Contact-led only in V2                               | Hardening        |
| V2 capacity        | Not represented                          | 500 / 2,500 / 10,000                                 | Additive         |
| Annual wording     | “2 months free”                          | “12 months for the price of 11”                      | Correction       |
| Annual credits     | Monthly reconciliation exists            | Explicit service-month contract, maximum 12 per term | Hardening        |
| Referral           | Derived from global plan capacity        | Snapshot by catalog generation                       | Hardening        |
| Campaign Readiness | Public pricing claim remains             | Remove numeric claim                                 | Correction       |
| Product IDs        | Legacy aliases                           | Distinct Legacy and V2 mappings                      | Additive         |
| Database           | Existing ledger and subscription columns | Reuse without migration                              | No schema change |

Scoring, API routes, Google Sheets route, DNS TTL, cached-credit policy, report downloads, Auth, and E8 external flags remain unchanged.
