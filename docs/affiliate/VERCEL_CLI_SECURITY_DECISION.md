# Vercel CLI security decision

## Decision

The repository-local `vercel` development dependency was removed. No application source imports it, and repository builds/tests do not require it. Deployment continues through the separately installed global Vercel CLI.

Safe npm overrides pin:

- `brace-expansion@1.x` to `1.1.16`;
- `brace-expansion@5.x` to `5.0.7`;
- `js-yaml` to `4.3.0`.

No `npm audit fix --force`, breaking framework downgrade, or application dependency removal was used.

## Evidence

- Full repository `npm audit --audit-level=high`: zero vulnerabilities.
- Full Vitest and Production build pass after lockfile regeneration.
- Global Vercel CLI version used for deployment inspection: 56.5.0.

The global CLI is an operator tool outside the deployable dependency graph. It must continue to be updated independently by operators.

