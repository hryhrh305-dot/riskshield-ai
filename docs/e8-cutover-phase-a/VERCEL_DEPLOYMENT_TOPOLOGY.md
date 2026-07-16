# Secwyn E8 Cutover Phase A — Vercel Deployment Topology

Verified: 2026-07-16 (Asia/Shanghai)

## Repository and deployment routing

- Canonical Git root: `D:/ai-saas-mvp`.
- Vercel project: `hrh-projects/riskshield-api` (historical infrastructure name; product is Secwyn).
- Git repository: `hryhrh305-dot/riskshield-ai` (historical repository name).
- Production branch: `main`.
- Phase A branch: `secwyn-e8-cutover-preview`.
- A push to `main` can create a Production deployment; Phase A did not push `main`.

## Phase A Preview

- Acceptance evidence commit: `4c8d41e` plus this final closeout documentation commit.
- Last writable acceptance deployment URL: `https://riskshield-i8x8jvh7q-hrh-projects.vercel.app`.
- Stable branch alias: `https://riskshield-api-git-secwyn-e8-cutover-preview-hrh-projects.vercel.app`.
- Target/state: Preview / READY.
- V2 pricing flag: restored to enabled in the branch-scoped Preview environment.
- V2 annual self-serve flag: restored to enabled in the branch-scoped Preview environment.
- The final closeout deployment keeps the public V2 catalog visible while branch-scoped Supabase, database, and Creem write credentials are replaced with fail-closed placeholders.

## Production

- Canonical URL: `https://www.secwyn.com`.
- Latest observed deployment: `dpl_WhZ...WC8r` (masked), READY.
- Observed deployment URL: `https://riskshield-j5gesz7xa-hrh-projects.vercel.app`.
- Production code remained on the existing `main` generation (`4f8a70e` observed in deployment metadata/build inspection), not the Phase A branch.
- Production aliases remained attached to Production.
- Several Production redeployments appeared during the Phase A window. They were external to this task and did not contain the Preview branch code.

## Phase A boundaries

- Push `main`: No.
- Production deployment by this task: No.
- Production alias change: No.
- Production environment change: No.
- Live Product creation: No.
- Real payment or refund: No.
