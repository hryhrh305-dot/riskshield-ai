# Secwyn Affiliate Fresh Database Replay Report

## Scope

This report records the controlled reconstruction of the isolated Affiliate Preview database. It contains no database URL, project reference, key, token, password, customer row, or personal data.

## Reset reason

The isolated Preview database had only the first three repository migrations applied. The fourth migration failed because the version-controlled migration chain assumed that the legacy Secwyn core schema had already been created manually. A clean replay is required to prove that a new Supabase project can be reconstructed from Git alone, without SQL Editor prerequisites or migration-history repair.

## Preflight evidence

- Git root and product identity: verified as Secwyn at the canonical repository root.
- Branch and remote: matched with zero divergence before the reset decision.
- Target identity: verified in memory as the explicitly authorized isolated Preview project.
- Production isolation: the target project reference differs from the read-only Production reference; Production was not connected or queried.
- Connection contract: Supabase Session Pooler, port 5432, database `postgres`, no whitespace or shell metacharacters.
- Remote migration history before reset: exactly the three known partial migrations.
- Data safety: zero Auth users, zero rows across all existing public tables, no payment/subscription/Affiliate/payout data.
- Seed decision: `--no-seed`; no `supabase/seed.sql` execution is authorized.
- Docker: local Docker daemon unavailable; no installation or system reconfiguration attempted.

## Baseline root cause

The repository contained an initial `supabase-schema.sql` and later SQL Editor scripts for core objects, but the formal migration directory began with referral and bulk-run changes. Therefore later migrations referenced `profiles`, `api_keys`, `subscriptions`, and `payments` before any migration created them. The existing tests asserted individual SQL contracts but did not replay all migrations from an empty PostgreSQL database.

## Selected repair

`202607090001_secwyn_core_schema_baseline.sql` is an additive, idempotent compatibility baseline sourced from the repository's schema, historical SQL, current server contracts, and Git history. Existing historical migrations remain unchanged. The baseline creates the complete repository-backed API-key contract and the core relations required by later migrations, enables RLS, and fixes `SECURITY DEFINER` search paths.

This approach was selected instead of editing an already-deployed historical migration, fabricating migration history, creating a one-column placeholder, or querying Production schema. Existing environments must treat this earlier baseline as an explicit reviewed compatibility migration; it does not run in Production as part of this Preview task.

## Runtime results

- Supabase CLI: 2.109.1.
- First clean replay: all 16 then-current migrations applied in order.
- Forward runtime hardening migration added after real immutability review.
- Final clean replay: all 17 migrations applied in order from an empty database.
- No seed was run during reset; content was applied separately after schema acceptance.
- Local and remote migration history match.
- A repeat `db push` was up to date.
- `db lint --level error` passed.
- Actual Affiliate schema: 60 tables, 20 functions, 12 SECURITY DEFINER transactional functions.
- RLS enabled: 60/60 Affiliate tables.
- No Production database connection, migration, reset or schema read occurred.

## PowerShell and local-file integrity

- The standalone `True` and `else` commands caused no Git, file or database state change.
- `.env.local` was valid UTF-8 without BOM or replacement characters.
- The temporary Preview URL appeared exactly once and was Git-ignored/untracked.
- After excluding that one temporary line, the logical environment content matched the pre-task backup.
- `supabase/.temp/` was absent and is now ignored by the exact `supabase/.temp/` rule.
- No secret entered Git diff, a tracked file, test output or report.

## Compatibility and Production gate

The baseline is additive and idempotent, but its position predates migrations already applied in older environments. Production application is therefore not automatic: it requires a separate schema-diff review and explicit HumanOps authorization. This Preview task did not modify Production.
