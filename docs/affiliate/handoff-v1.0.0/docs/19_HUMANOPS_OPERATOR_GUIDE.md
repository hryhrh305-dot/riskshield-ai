# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## Production DB
审核 Migration、备份、应用、RLS 验证、回滚窗口。

## Telegram Bot
1. 通过 Telegram 官方流程创建；
2. Token 不发聊天/仓库；
3. 放 Production Secret；
4. 获取频道 chat_id；
5. 添加为管理员；
6. 最小 Post Messages，必要时 Edit Messages；
7. Admin permission health；
8. 先测试消息；
9. 用户确认；
10. 再开 daily flag。

## 频道
Welcome/Anti-Scam 已置顶。Bot 真实创建后才更新置顶帖中的 Bot 用户名。佣金、激活、渠道、归因、Payout、Anti-Scam 变化时检查全部 6 条。

## Payout
Payoneer/KYC、Payout Account、人工 Batch、PIN、真实转账、回填证据、结算通告。

## Production Flags
每次只开一层，观察日志、对账、投诉。

## Qualified Win
确认 consent、alias、Qualified、无退款/欺诈、文案/金额、无客户信息。

## 不得提供给 Codex/Git
Bot Token、Supabase Service Role、Creem Secret、Payoneer Credential、Payout PIN、PAN/KYC 原件。
