# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 单一配置
所有金额、期限、能力和公开变量读取 `machine/25_RULES_MANIFEST.json`。不得散落硬编码。

## Rule Version
包含 program、version、effective time、phase、price snapshot、commission、accelerator、referral、team、cold start、attribution、activation、reserve、payout、compliance、retention guards、engine version。发布后不可修改，变化创建新版本。

## 两阶段
- 每个 Program 独立 Launch 12 个月；
- 以 Program 公开启动时间为基准；
- first_paid_at 锁定版本；
- Launch 订单跨第 13 个月仍按 Launch；
- Evergreen 新订单按 Evergreen；
- 不按 Affiliate 加入日滚动；
- Launch 临时奖励在 Evergreen 永久关闭。

## Capability
```ts
{
  provisionalActivation: true,
  teamRewards: true,
  accelerators: true,
  coldStartRewards: true,
  contentLibrary: true,
  telegramAutomation: true,
  payoutWorkflow: true,
  affiliateColdEmail: false,
  automatedDm: false,
  bulkMessaging: false,
  paidAds: false
}
```

删除功能=新版本 capability false，不删除历史。

## 发布门禁
Schema、Golden、成本、Evergreen 11%、Retention、Impact、Telegram Sync、Effective Time、Dry Run、Admin Reauth。

## 动态变量
`{program.name}`、`{commission.launch.growth.annual}`、`{attribution.click_to_registration_days}`、`{activation.provisional_days}`、`{payout.minimum_usd}` 等。解析失败拒绝发布。
