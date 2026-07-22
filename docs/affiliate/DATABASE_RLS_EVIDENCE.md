# Affiliate database and RLS evidence

## Fresh replay

- 17 migrations apply from an empty isolated Preview database.
- No SQL Editor DDL, migration repair, linked project or Production database was used.
- Actual schema: 60 Affiliate tables and 20 Affiliate functions.
- Every Affiliate table has RLS enabled.

## Role matrix

- Authenticated user A saw exactly their own membership and zero rows for user B.
- `anon` was denied private membership reads.
- `authenticated` was denied direct Ledger insertion.
- Sensitive writes remain service-role only; the application revalidates authenticated sessions and operator roles server-side.
- Operator duties separate content editor/reviewer/publisher from Affiliate administration. Payout operations remain closed.

## SECURITY DEFINER

All 12 SECURITY DEFINER Affiliate functions have a fixed `search_path=public`. Their ACL contains the owner and `service_role`, with no `public`, `anon` or `authenticated` execute grant.

## Immutability

Database triggers reject destructive changes to published rules/content, Decisions, audits, Ledger, schedules, payout snapshots, Provider Sale identity/facts, Reconciliation results and Outbox identity/payload. Operational Outbox claim/status fields remain updateable so workers can process events without rewriting the event fact.

Runtime mutation result: 6/6 direct update/delete probes rejected.

## Isolation caveat

This evidence is from the isolated Preview database. Production migration remains a separate HumanOps review and authorization gate.

## Operational Acceptance Hardening

- The isolated Preview database contains only synthetic `.invalid` test identities and no Production customer copy.
- Approved user A could read exactly one own membership, zero other memberships and zero Ledger entries.
- Anonymous direct table access failed closed with permission denied.
- Five trigger functions were hardened additively with `search_path=public`: delete prevention, mutation prevention, payout-item protection, published-content protection and terminal-sale protection.
- Supabase security advisor after migration: Affiliate Critical 0, Error 0, Warning 0. Fifty-four Affiliate informational notices reflect intentional RLS-enabled, service-only tables.
- The migration was applied only to the isolated Preview database. Production database changes: 0.
