# Secwyn E8.5 Decision Integrity Rollback

This patch is one local Git commit named `Harden Secwyn decision integrity across audit channels`. It changes code, tests and documentation only.

## Safe local rollback

1. Confirm the Git root is exactly `D:/ai-saas-mvp` and the working tree contains no unrelated edits.
2. Identify the E8.5 commit with `git log -1 --oneline`.
3. Create a normal inverse commit with `git revert <E8.5-commit-hash>`.
4. Run `npm test` and `npm run build`.
5. Review `git diff --check` and `git status --short`.

Do not use `git reset --hard`, force push, destructive SQL or manual profile-credit edits.

## Data rollback

No database schema, migration, RLS, RPC, production row, credit grant, payment, referral, Auth user, environment variable, DNS value or Google Sheets deployment was changed. Therefore there is no database or data rollback.

The local tests and benchmark consumed zero credits and made zero paid vendor calls.

## Future deployed rollback

If this commit is later deployed and an incident is observed:

1. Disable traffic to the affected operation only if an existing operational control is already available; do not invent a production flag during the incident.
2. In Vercel, identify the last READY production deployment immediately before the E8.5 commit.
3. Promote or roll back to that known READY deployment using the normal Vercel deployment history control.
4. Revert the Git commit normally and let the repository deployment pipeline produce a traceable replacement deployment.
5. Verify login, single check, bulk check, API batch, Sheets contract, credit idempotency and downloads.
6. Compare decision distribution and credit usage logs before restoring full traffic.

Because the change is additive and database-free, rollback does not require a migration down script, backfill, payment repair, secret rotation or cache deletion. Old cached rows remain defensively re-evaluated by whichever application version is active.
