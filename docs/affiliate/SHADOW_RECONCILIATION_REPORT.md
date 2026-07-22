# Affiliate Shadow and reconciliation report

## Deterministic simulation

The local test suite verifies all supplied Golden vectors and the full Launch/Evergreen plan matrix, integer minor-unit arithmetic, HALF_UP rounding, annual schedules, 30/60-day reserves, refunds, chargebacks, referral depth, self-referral, replay, concurrent calculation and payout gates.

The Shadow worker now records a sale and decision through one transactional RPC. Reversals use a separate transactional RPC that validates replay content, locks the sale and decision, prevents cumulative clawback above the original decision, and handles partial refunds without incorrectly terminalizing the sale.

Daily reconciliation compares:

- non-pending sales and decisions;
- gross decisions plus negative reversal/clawback entries;
- net ledger amount;
- approved/paid/reconciled payout totals;
- open High/Critical incidents.

## Runtime status

Preview Shadow events processed: 0.

Reason: the isolated Preview migration has not been applied because the migration transport is unavailable. The ordered Shadow flag remains false. No real commission, team reward or payout was created.

The rollout gate remains a minimum 30-event representative Preview sample with zero unexplained Primary/Audit or reconciliation mismatch.

