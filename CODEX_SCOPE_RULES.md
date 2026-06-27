# CODEX Scope Rules

本文件是 RiskShield AI 第一阶段的执行边界说明。

## 当前阶段不要做

- 不要做低价基础清洗产品层
- 不要接 HIBP
- 不要做泄露库 / 社工库
- 不要依赖 Spamhaus 商业查询
- 不要做 Reacher / SMTP 代理池
- 不要做手机号风险
- 不要做 Fintech / LegalTech / 保险垂直版
- 不要做完整 Salesforce / HubSpot OAuth
- 不要迁移旧 route
- 不要清全量 lint
- 不要大改支付 / 登录 / webhook

## 当前阶段要坚持的方向

- Pre-send List Audit
- Outbound List Intelligence
- Agency-ready Campaign Risk Report
- Client-ready report
- Send / Review / Suppress 决策
- Campaign Readiness Score
- Top Risk Reasons
- Estimated Waste Prevented
- Export / handoff workflow

## 允许的延伸

- 轻量规则常量
- 文档
- 轻量 smoke test
- 报告结构优化
- 导出格式优化

## 不要把底层能力误当产品层

基础邮箱检测、基础 IP 检测、基础风险引擎只是底层能力。
前台主产品不应再以普通 email verification 为主叙事。

## 只在必要时推进下一步

后续顺序优先考虑：

1. 统一规则常量
2. 统一文档
3. Credits ledger
4. Suppression workspace 化
5. Report archive / share link
6. 再考虑 API / white-label / realtime gate
