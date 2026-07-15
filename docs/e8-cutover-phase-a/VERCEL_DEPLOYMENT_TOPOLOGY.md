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

- Final code commit: `118c12e` before the acceptance-document commit.
- Deployment ID: `dpl_Ago...FyBd` (masked).
- Deployment URL: `https://riskshield-86qy3zj1z-hrh-projects.vercel.app`.
- Stable branch alias: `https://riskshield-api-git-secwyn-e8-cutover-preview-hrh-projects.vercel.app`.
- Target/state: Preview / READY.
- V2 pricing flag: enabled in the branch-scoped Preview environment for final acceptance.
- V2 annual self-serve flag: enabled in the branch-scoped Preview environment for final acceptance.

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
