# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## Flags
`AFFILIATE_PUBLIC_PAGE`
`AFFILIATE_APPLICATIONS`
`AFFILIATE_PROVISIONAL_ACTIVATION`
`AFFILIATE_ATTRIBUTION`
`AFFILIATE_COMMISSION_SHADOW`
`AFFILIATE_COMMISSION_REAL`
`AFFILIATE_TEAM_REWARDS`
`AFFILIATE_PAYOUT_CREATION`
`AFFILIATE_PAYOUT_EXECUTION`
`AFFILIATE_CONTENT_ADMIN`
`AFFILIATE_TELEGRAM_DAILY`
`AFFILIATE_TELEGRAM_WINS`
`AFFILIATE_TELEGRAM_PAYOUT_NOTICE`
`AFFILIATE_ADMIN`

默认全部 false。

## 顺序
Public → Application → Provisional → Attribution → Shadow → Real Commission → Team → Payout Creation → Payout Execution → Telegram Daily → Wins → Payout Notice。

## Canary
内部 Admin → Test Affiliate → 小规模真实 Affiliate → Shadow/每日对账 → 扩大。

## Rollback
App：关 Flag/回滚部署；DB：forward-fix、Expand、备份恢复；Telegram：pause/retract/clarify；Commission：停止生成/付款，只用 Adjustment/Reversal，不覆盖历史。

每个 Kill Switch 必须演练：停止新动作、历史可读、主业务不受影响、恢复不重复。
