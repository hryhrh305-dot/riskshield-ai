# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 频道
`Secwyn India Affiliate Updates`，English，Asia/Kolkata。6 条基础消息已发布，Welcome/Anti-Scam 置顶。真实 Bot 尚未创建。

## 自动发布
1. 每日 Approved English Script Card；
2. Approved 素材/培训/FAQ；
3. Paid + Reconciled Payout 通告；
4. Qualified Sale Verified Win；
5. 规则更新/同步提醒；
6. Anti-Scam/Compliance。

## 禁止
Bot 不计算佣金、不读原始 Creem/KYC/银行、不自由生成未审批内容、不发 Pending/Test/自购/欺诈喜报、不把 Processing 说成 Paid、不重复事件、不收报名费/密码/PIN/银行资料。

## 每日内容
每自然日最多 1 条 scheduled；事件帖独立上限；后台可配时间，初始建议 12:30 IST；只从 Approved+Published+Effective 选择；避免短期重复；发送前校验变量、披露和长度。

## Qualified Win
live payment、valid attribution、first qualified、eligible affiliate、self-referral passed、fraud passed、commission qualified、consent、kill switch off、idempotency unique。公开级别：不公开/匿名/批准别名。绝不公开客户、订单、KYC、收款。

## Payout Notice
仅 batch Paid + reconciliation Passed + 证据确认 + snapshot hash 不变。

## 幂等与失败
唯一键 program+channel+type+source event+template version。超时进入 UnknownDelivery，不盲目重发。支持 retry、dead letter、alert、permission health、pause、audit。

## 权限和 Secret
HumanOps 添加管理员，最小 Post Messages，必要时 Edit Messages。Token 仅服务端 Secret，DB 存 reference，日志/前端/错误不得泄露，测试 mock。

## Admin
Overview、Calendar、Event Rules、Preview、Failures、Dead Letter、Sync、Pause、Permission Health。
