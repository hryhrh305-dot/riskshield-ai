# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 推荐目录
```text
src/modules/affiliate/
├── domain/{
│   entities,value-objects,policies,state-machines,events,errors}
├── application/{commands,queries,services,dto,validators}
├── ports/{repositories,clock,payment-events,telegram,payout,notifications}
├── adapters/{supabase,creem,telegram,payout,email,telemetry}
├── programs/{registry,secwyn,flowwyn-placeholder}
├── content/
├── telegram/
├── jobs/
├── ui/
├── admin/
└── tests/
```

先适配当前仓库，不机械照搬。稳定后才考虑提取 packages。

## Import
domain 只依赖纯类型；application 依赖 domain/ports；adapters 实现 ports；UI 只调用 application；API 不直接写业务表；Worker 不复制计算；Telegram 不调用 Calculator；Admin 调整只创建 Adjustment。

## Money
```ts
type Money = { amountMinor: bigint; currency: "USD" }
```
禁止 JS number 表示钱。

## Time
UTC 存储，Program 月份用 Asia/Kolkata；Clock 可注入测试。
