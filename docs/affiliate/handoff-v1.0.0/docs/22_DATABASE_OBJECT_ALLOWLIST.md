# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


只允许 `affiliate_` 前缀表、必要的 Adapter/API/UI/docs。允许函数：rule resolution、attribution lock、idempotent claim、ledger append、reconciliation、batch snapshot、content publish、Telegram claim、RLS helper。

未经 E0 证明和兼容方案，不得修改现有 subscription、credits ledger、scan/report、Creem 主事务、entitlements、Legacy、Referral 历史、Auth critical fields。

修改现有 webhook 唯一允许形式：同事务写轻量标准 Outbox/Adapter；不得同步做 Affiliate 计算；Affiliate 失败不得回滚付款；必须 regression。
