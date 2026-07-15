# Secwyn E8.8 Annual Lifecycle Test Matrix

| Scenario                            | Expected                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| First annual paid event             | One monthly grant, annual paid-through recorded, one referral snapshot             |
| Duplicate paid webhook              | Existing grant/reward replay; no second credit or reward                           |
| Service month 2–12 reconciliation   | Exactly one grant at each anchor boundary                                          |
| Service month 13 before renewal     | Rejected as outside term                                                           |
| Annual renewal payment              | New term anchor and month index 0; new payment-linked grants; no new referral      |
| End-of-term scheduled cancel        | Status remains active during term; monthly grants continue; no renewal             |
| Immediate cancel                    | Future reconciliation stops                                                        |
| Full refund                         | Transaction-linked unused credits revoked; future grants stop; no negative balance |
| Partial refund                      | Recorded/manual handling; no unverified destructive credit action                  |
| Dispute/chargeback                  | Transaction-linked unused credits revoked; subscription paused; future grants stop |
| Upgrade monthly to annual           | Apply at approved cycle boundary; no invented proration promise                    |
| Annual downgrade/monthly transition | Apply at annual term end                                                           |
| Legacy annual Scale                 | 15,000 per service month, up to 12                                                 |
| V2 annual Scale webhook recognition | 10,000 per service month if externally configured; public checkout remains blocked |
| Missing/unknown Product ID          | No entitlement, grant or referral; fail closed                                     |
| Product/plan mismatch               | Webhook fails closed                                                               |
