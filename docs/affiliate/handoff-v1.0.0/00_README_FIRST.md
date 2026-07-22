# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 1. 文件包用途

这是一次性交给 Codex 的完整工程交接包。它把《推广机制》印度版 v2.0，以及最近几轮已锁定的模块化架构、佣金完整性、反刷、内容运营、Telegram 自动发布、测试、灰度和回滚要求统一为可执行 Source of Truth。

目标不是快速拼几个页面，而是完整实现：

1. India Affiliate 公开招募、申请、Provisional、Approved、Active；
2. 30 天点击注册归因、90 天首次付款窗口和一次 30 天人工延长；
3. Launch Boost 与 Evergreen 不可变规则；
4. 个人佣金、加速器、直属推荐奖、团队奖、冷启动奖；
5. 30/60 天风险准备金、年付分期、退款、拒付和 Clawback；
6. 只追加账本、独立审计计算器、每日对账和付款门禁；
7. 一代直属关系硬边界；
8. 话术库、资料库、模板库、FAQ、培训和素材后台；
9. Telegram 每日英文话术卡片、素材、结算通告和 Qualified Win 喜报；
10. Affiliate Portal、Leader Portal、Admin Console；
11. 多 Program 可复用架构，Secwyn 先启用，Flowwyn 只保留接入能力；
12. Feature Flags、Shadow Mode、Preview、回滚和 HumanOps。

## 2. 诚信边界

任何软件都不能诚实保证绝对无漏洞。本包把 PASS 定义为：

- 0 个已知 Critical / High；
- 0 个未解决的重复计佣路径；
- 0 个已知越权或跨 Program 泄露；
- 0 个 skipped / only / 安全 TODO；
- 0 个前端可伪造佣金或 Affiliate 身份的接口；
- 0 个未经对账即可真实付款的路径；
- Mutation、Property、并发、重放、RLS、E2E 和 Shadow 证据完整；
- 任一完整性异常自动暂停佣金或付款。

Codex 不得把“测试通过”表述为“绝对无漏洞”。

## 3. 使用方法

1. 把整个 ZIP 发给 Codex；
2. 原样发送 `01_SEND_TO_CODEX_PROMPT.txt`；
3. Codex 先进入 `D:\ai-saas-mvp` 并只读审查；
4. 只允许单 Agent；
5. 内部连续完成 E0～E17，最终一次汇报；
6. 真实密钥、Telegram Bot、Production Migration、真实结算和付款停在 HumanOps Gate。

## 4. Source of Truth

1. 本包 `docs/01_SOURCE_OF_TRUTH_AND_CONFLICT_RULES.md`；
2. 本包工程规范、Rules Manifest 和 Golden Vectors；
3. `references/《推广机制》印度版_v2.0...txt`；
4. 用户最新明确状态；
5. 仓库、Supabase、Vercel、Creem 的可验证事实；
6. v1.5.8 总纲未被新状态覆盖的部分；
7. 外部服务以实施当日官方文档为准。

## 5. 关键文件

- `01_SEND_TO_CODEX_PROMPT.txt`：唯一启动指令；
- `docs/00_MASTER_IMPLEMENTATION_TASK.md`：E0～E17；
- `docs/08_COMMISSION_ENGINE.md`：确定性佣金；
- `docs/09_COMMISSION_INTEGRITY_AND_ANTI_ABUSE.md`：反刷和资金安全；
- `docs/11_CONTENT_OPERATIONS_LAYER.md`：经常更新内容；
- `docs/12_TELEGRAM_AUTOMATION_LAYER.md`：Telegram 自动化；
- `docs/15_TEST_STRATEGY_AND_ACCEPTANCE.md`：测试；
- `docs/24_NO_GO_GATES.md`：硬门禁；
- `machine/25_RULES_MANIFEST.json`：机器可读规则；
- `machine/26_GOLDEN_TEST_VECTORS.json`：黄金用例；
- `machine/24_REQUIREMENTS_TRACEABILITY_MATRIX.csv`：追踪矩阵。
