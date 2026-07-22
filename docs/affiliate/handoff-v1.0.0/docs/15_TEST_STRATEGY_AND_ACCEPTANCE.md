# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 层级
Domain Unit、Rule Schema、Golden、Property、Mutation、Repository Integration、DB Constraints、RLS、Replay、Concurrency、API Authorization、E2E、Telegram Mock、Migration、Rollback、Shadow、Reconciliation、非 Affiliate Regression。

## 必须覆盖
Plan×Billing×Phase、Accelerator 边界、Evergreen 0.5% 舍入/$75 cap、Team、Cold Start、Reserve、Schedules、Refund/Chargeback、Rule Switch、India month boundary、Duplicate Event、Two Workers、Self Referral、A/B/C、Cross Program、Payout Freeze、Telegram Duplicate、Variable Failure、Published Only、Kill Switch。

## Mutation
至少变异：first payment、self referral、depth=1、live environment、qualified、batch paid、reconciled、content published、win consent、idempotency。关键 mutation 存活不得 PASS。

## Property
- 同一 sale 不能两次 base；
- A 不从 C 获利；
- Refund 后净额不增加；
- 未 Qualified 不 Payable；
- Paid 不可改；
- Evergreen ≤11%；
- Paid ≤ Approved Payable；
- 一个 customer 一个 first payment；
- 一个 B 一个 inviter；
- 一个 event 一个 Telegram publication。

## 命令证据
Codex 使用仓库真实 lint/typecheck/unit/integration/RLS/E2E/build/validate/migration/mutation/security 命令，最终列原始结果和数量，不得只写 passed。
