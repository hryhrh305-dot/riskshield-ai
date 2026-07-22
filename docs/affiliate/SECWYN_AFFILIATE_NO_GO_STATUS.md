# Affiliate No-Go status

Current verdict: **FAIL CLOSED — Preview runtime database gate incomplete**.

Local implementation gates pass:

- 445/445 Vitest tests pass with no skipped/only tests.
- Production build generates 71 routes/pages.
- Modified TypeScript/TSX files pass targeted ESLint.
- Full repository TypeScript remains at the documented 120-error baseline; Affiliate adds no new error.
- Full repository `npm audit --audit-level=high` reports zero vulnerabilities.
- All Affiliate feature flags remain closed and the kill switch remains enabled.

The repository-local Vercel CLI dependency was removed because no application code imports it. Deployment uses the separately maintained global CLI. Safe overrides pin the affected `brace-expansion` and `js-yaml` transitive ranges; no force upgrade was used.

No-Go conditions still present:

- The isolated Preview Supabase migration has not been applied because the management migration transport cannot currently send even a minimal DDL statement. Migration history remains empty, proving no partial write.
- Live Preview RLS, constraint, replay, concurrency, content seed, Shadow, reconciliation, and Telegram mock-runtime evidence therefore cannot yet be collected.
- Production migration, Production variables, Production flags, real commission, payout, real Telegram publishing, and provider operations remain HumanOps-only.

Real Commission cannot be enabled until a representative Shadow sample (minimum 30 events) reconciles with zero unexplained mismatch and zero known Critical/High issue. Payout and Telegram gates remain later in the ordered sequence.
