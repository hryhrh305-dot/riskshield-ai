# Secwyn Affiliate Preview runtime acceptance

Date: 2026-07-22

## Isolation

- Vercel project: `riskshield-api`.
- Target: Preview only, branch `codex/secwyn-india-affiliate-full`.
- Database: independent, empty-customer Supabase Preview project; reference intentionally omitted.
- Production database was never connected, queried, migrated or reset.
- Vercel reported 23 Sensitive variables, all scoped to Preview and the Affiliate branch.
- Production variables and Production deployment were not modified.

## Fresh Database

- The initial partial history contained only the first three historical migrations.
- Root cause: core tables had historically lived in repository SQL Editor scripts rather than ordered migrations.
- A repository-backed core baseline migration was added before historical migrations.
- A guarded `db reset --db-url --no-seed` replayed all 17 migrations from empty state.
- A second push was up to date and `db lint --level error` passed.

## Runtime results

| Gate | Result |
|---|---|
| Affiliate tables | PASS — 60 |
| Affiliate functions | PASS — 20 |
| RLS | PASS — 60/60 enabled |
| SECURITY DEFINER ACL | PASS — 12/12 service-role only |
| Owner/cross-owner/anon matrix | PASS |
| Immutable mutation probes | PASS — 6/6 rejected |
| Shadow database scenarios | PASS — 36 |
| Primary/Audit mismatch | PASS — 0 |
| Payment replay | PASS — 100 calls, one business outcome |
| Refund replay | PASS — 100 calls, one Clawback |
| Chargeback replay | PASS — 100 calls, one Clawback |
| Outbox worker claims | PASS — 100/100 unique |
| Telegram queue claims | PASS — 100/100 unique |
| Daily publication | PASS — one channel/date row |
| Content publish concurrency | PASS — one publication |
| Rule publish concurrency | PASS — one schedule, idempotent replay |
| Content seed | PASS — 24 records / 7 slots, two-run idempotency |
| Production changes | 0 |

## Remaining external gate

Bot and private test-channel variables exist as Vercel Sensitive values, but their plaintext values are correctly unavailable through the connected Vercel tooling. No real-channel message was sent. Private-channel external delivery remains HumanOps; all mock, policy, database queue and concurrency checks passed.
