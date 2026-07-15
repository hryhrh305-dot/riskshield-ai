# Secwyn E8.6 Rollback

E8.6 is an additive website-positioning and theme commit. It does not include a migration, environment change, deployment, payment action, or production data mutation.

## Preferred rollback

After the E8.6 commit exists, create a normal revert commit:

```text
git revert <e8-6-commit-hash>
```

Do not reset, force-push, or rewrite the E8.5 commit.

## Partial rollback boundaries

If only the theme needs removal, revert:

- `src/components/theme/ThemeToggle.tsx`
- theme initialization in `src/app/layout.tsx`
- E8.6 theme blocks in `src/app/globals.css`
- `rs-legal` wrapper classes

If only positioning needs removal, revert homepage, pricing copy, route metadata, docs support copy, auth metadata, and 404. Keep business-logic files untouched.

## Post-rollback checks

1. `git diff --check`
2. E8.5 targeted tests and full Vitest
3. `npm run build`
4. Claim scan for `RiskShield`, `574269.xyz`, unsupported guarantees, false AI/vendor claims, and legacy free allowances
5. Confirm plan values and risk thresholds remain unchanged
6. Confirm the working tree contains only the deliberate revert

## Production note

This task does not deploy. If a future authorized deployment contains E8.6, rollback also requires an explicitly authorized deployment of the revert commit.
