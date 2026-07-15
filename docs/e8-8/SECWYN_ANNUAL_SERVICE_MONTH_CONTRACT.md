# Secwyn E8.8 Annual Service-Month Contract

1. An annual payment opens one paid annual term; it does not grant twelve months of credits upfront.
2. Credits are issued from the subscription’s immutable credit anchor on each service-month boundary.
3. A term permits at most 12 service-month grants and never grants beyond `paid_through`.
4. The stable identity includes subscription, paid term, service-month index, catalog generation, plan and grant type.
5. A replay of the same identity returns the existing grant. Conflicting amount or period fails closed.
6. A scheduled cancellation keeps the subscription active and monthly grants continue through the paid term.
7. Immediate cancellation, full refund, dispute or chargeback stops future grants. Existing usage/history is retained and no negative balance is created.
8. A renewal transaction opens a new annual term and a new set of service-month identities.
9. Month-end anchors use the last valid day of shorter months; UTC timestamp precision is preserved.
10. The existing `credit_grants` ledger and transaction-scoped reversal remain authoritative; no migration is required for this local preparation.
