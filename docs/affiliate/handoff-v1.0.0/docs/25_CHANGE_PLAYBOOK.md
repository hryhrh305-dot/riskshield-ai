# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 改佣金
新 Rule Version → 新 Golden → 11%/Retention → Shadow → Impact → Telegram 新文案 → Effective Time → Publish；旧订单不变。

## 加奖励
新增 Policy、Config、Ledger Type、Capability、Tests、Content Dependency、Reconciliation；不得在 webhook 堆 if。

## 删奖励
新版本 capability=false；新订单停止；历史保留；内容下架；不删字段。

## 改内容
后台 Draft 新版本、预览、审查、发布；不部署。

## 改 Schema
Schema Version、Migrator、Dual Render、Backfill、Verify、Deprecate。

## 改 DB
Expand → Migrate → Verify → Contract。

## 换 Provider
新 Adapter，不改 Domain。

## Flowwyn
Program Config、Rule、Capabilities、Content Override、Product Adapter、Channel、Tests；不自动加入；独立 Launch/ledger/team/attribution。
