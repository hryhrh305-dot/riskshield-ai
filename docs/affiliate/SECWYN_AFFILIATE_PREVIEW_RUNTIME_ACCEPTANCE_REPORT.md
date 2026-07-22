# Secwyn Affiliate Preview runtime acceptance

Date: 2026-07-22

## Environment isolation

- Vercel project: `riskshield-api`.
- Target: Preview only, branch `codex/secwyn-india-affiliate-full`.
- Isolated Supabase project: `secwyn-affiliate-preview` (reference intentionally masked).
- The 23 configured Affiliate/Supabase runtime variables are scoped only to Preview and the Affiliate branch.
- No Affiliate variable is present in Production scope.
- `AFFILIATE_CONTENT_SEED_TARGET` is not a runtime requirement; it is required only for an explicit seeder apply operation.
- All capability flags remain false; the kill switch remains true.

## Deployment observation

The environment-variable save was followed by a Production redeploy of the existing `main` build, not an Affiliate branch redeploy. That deployment remained `READY`, contained neither Affiliate code nor Affiliate variables, and caused no Affiliate activation. The Affiliate branch Preview remained on its prior safe flags-off build pending the current commit.

## Acceptance state

| Gate | Result |
|---|---|
| Branch and remote identity | PASS |
| Production isolation | PASS |
| Variable scope/name presence | PASS; values intentionally unreadable because they are Sensitive |
| Local tests/build/lint/audit | PASS |
| Preview migration | BLOCKED by Supabase migration transport |
| Preview seed/RLS/runtime probes | NOT RUN; migration prerequisite absent |
| Shadow/reconciliation runtime | NOT RUN; migration prerequisite absent |
| Telegram external delivery | NOT RUN; external HumanOps and ordered flag gate |
| Production changes | NONE |

Migration history was rechecked after every failed attempt and remained empty. No partial schema write occurred.

