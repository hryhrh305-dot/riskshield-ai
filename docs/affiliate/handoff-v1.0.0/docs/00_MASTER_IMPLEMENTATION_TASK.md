# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 总任务

在不破坏 Secwyn 现有支付、订阅、检测、报告、50 次免费体验和生产稳定性的前提下，一次性完成可上线但默认关闭的完整 Affiliate 平台。

代码一次完成不等于功能一次全开。所有生产功能默认关闭，先本地、测试和 Preview，再 Shadow Mode，最后 HumanOps 授权。

## E0：只读审查
确认 Git、依赖、Next.js、Supabase、Creem、Vercel、Referral、Ledger、Auth、RLS、Admin、Flags、测试基线。形成内部计划、白名单和风险，不中途停。

## E1：Source of Truth 入库
把本包工程文档复制到仓库 `docs/affiliate/`，保留版本与哈希，不得只复制不实现。

## E2：模块骨架
建立 Domain、Application、Ports、Adapters、Programs、Content、Telegram、Admin、Jobs、Tests。Domain 不依赖 React、Next、Supabase、Creem、Telegram 或环境变量。

## E3：数据库和 RLS
完成新表、索引、唯一约束、外键、RLS、审计、Outbox、Dead Letter、只追加 Ledger、迁移与回滚。本地/测试完整验证，Production 不执行。

## E4：Program / Rule / Capability
实现 program_id、Membership、不可变 Rule Version、Launch 12 个月、Evergreen、Capability、11% Gate、80% Retention Guard 和 Content Impact。

## E5：申请和激活
India-only 申请、Policy、5 题、7 天 Provisional、一次 3 天 Grace、3 次行动/2 种形式、有效注册/机会/付款提前批准、90 天无首单失效、Approved/Suspended/Terminated、India Founding Affiliate。

## E6：Referral 和 Attribution
30 天点击注册、注册锁定、90 天付款、一次 30 天延长、最长 120 天、canonical customer、唯一首付、续费/升级/月转年/重注册不重复、管理员 Adjustment 不覆盖历史。

## E7：佣金完整性
Eligibility、Attribution Validator、Primary Calculator、Independent Audit Calculator、Decision、Ledger、Schedules、30/60 Reserve、Launch/Evergreen、Base、Accelerator、Direct Referral、Team、Cold Start、Refund/Chargeback/Clawback、Reconciliation、Payout Gate、Kill Switch。

## E8：Content Operations
Copy、Template、Resource、Training、FAQ、Telegram、Recruitment、Asset；Draft→Review→Approved→Published；Blocks、Version、Variables、Inheritance、Preview、Diff、Rollback、Import/Export、Search、Emergency Deprecate、Impact Checker、6 个 Telegram Slots。

## E9：Portal 和 Admin
公开、申请、Affiliate、Leader、Admin、Content Admin、Telegram Admin、Payout Admin、Compliance Admin。页面只调用 Application Service。

## E10：Events / Outbox / API
标准事件、Transactional Outbox、Retry、Dead Letter、幂等、correlation。Affiliate 失败不得回滚支付。

## E11：Telegram
Bot Adapter、Channel Registry、Asia/Kolkata 日历、每日最多 1 条计划内容、Approved Pool、素材、Qualified Win、Paid/Reconciled Notice、隐私授权、幂等、Unknown Delivery、Retry、Preview、Pause、6 条同步、Mock。真实 Bot 为 HumanOps。

## E12：Payout
Draft→Approved→Processing→Paid；$50；每月 28 日；Payout PIN、OTP、Reauth、72 小时冻结、批次 hash。第一版允许人工 Payoneer，禁止未授权真实自动打款。

## E13：测试
Unit、Integration、Database、RLS、E2E、Replay、Concurrency、Property、Mutation、Golden、Telegram、Permission、Migration、Rollback、Kill Switch。0 skipped/only/TODO。

## E14：Shadow
至少 30 笔、12 基础组合、5 refund、2 chargeback、3 referral、2 accelerator、2 team、1 rule switch、1 payout freeze、100 duplicate webhook、Primary=Audit。

## E15：Preview 和 Operator Guide
完成 Preview、模拟演示、回滚、备份恢复说明。

## E16：最终审查
Traceability、No-Go、DoD、diff、git status、build、tests、migration、secret scan、dependency audit、旧价格/硬编码金额/敏感字段扫描。

## E17：最终报告
严格按模板，给出命令、数量、证据、风险、Shadow、Telegram、回滚、HumanOps 和 Git 状态。不得声称绝对无漏洞。
