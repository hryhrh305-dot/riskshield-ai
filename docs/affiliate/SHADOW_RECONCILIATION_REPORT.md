# Affiliate Shadow and reconciliation report

## Database Shadow pack

- Scenarios executed in real isolated PostgreSQL: 36.
- Plans: Starter, Growth and Scale.
- Intervals: monthly and annual.
- Phases: Launch and Evergreen.
- Primary/Audit mismatch: 0.
- Shadow Ledger entries remain excluded from payable balances.

## Replay and concurrency

- Same payment event ×100: one Sale, one Decision, one Ledger entry, one Outbox event.
- Same refund event ×100: one Clawback.
- Same chargeback event ×100: one Clawback.
- Cumulative Clawback cannot exceed the original Decision.
- 100 Outbox workers claimed 100 distinct rows.

## Reconciliation

Reconciliation compares source sales, Decisions, net Ledger, Payout batches and open High/Critical incidents. Results are immutable. A same-day retry reads and returns the stored result instead of updating financial evidence.

Real Commission, reserve release, team reward and payout remain disabled. A prolonged representative Shadow window is still required before any Production activation.

## Operational Acceptance Snapshot

- Synthetic direct graph: A-B = 1, B-C = 1, A-C = 0.
- Real Ledger rows: 0.
- Payout batches/items: 0/0.
- Primary/Audit mismatch: 0.
- Duplicate commission: 0.
- Affiliate A earnings from Affiliate C: 0.
- Safe Preview flags allowed application, attribution and Commission Shadow evidence only. Real Commission, Team Rewards and all payout flags remained false.
- Kill Switch was released only for the isolated Preview acceptance after dangerous capabilities were independently disabled; Production Kill Switch and flags were not modified.
