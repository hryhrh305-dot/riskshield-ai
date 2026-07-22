# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 结论
模块化单体 + 六边形边界 + 事件驱动 + 不可变 Rule Version + 只追加 Ledger + Transactional Outbox + Capability Registry + Feature Flags + Shadow Mode。不得拆微服务，不强制 Monorepo。

## 结构
```text
Existing Secwyn
├── Auth / Registration
├── Creem / Subscription
├── Credits / Reports
└── Existing Referral
      │ 标准化事件
      ▼
Affiliate
├── Domain
├── Commission Integrity
├── Content Operations
├── Telegram Automation
├── Application Services
├── Ports / Adapters
├── Portal / Leader / Admin
├── Outbox / Jobs / Reconciliation
└── Tests
```

## 隔离
Affiliate 失败不得阻止付款、改订阅、重复 Credits、影响检测、返回客户 500 或发错误喜报。支付成功后 Affiliate 失败：主事务成功、Outbox 重试、佣金未生成/Pending、管理员告警。

## Domain
不得依赖 Next/React/Supabase/Creem/Telegram/Vercel/环境变量/隐式当前时间。外部输入经 Clock、Repository、Payment、Telegram、Payout、FX、Risk Ports。

## Program
平台身份与 Membership 分离。所有归因、销售、佣金、团队、考试、内容、Telegram 都带 program_id，Secwyn 与 Flowwyn 不串数据。
