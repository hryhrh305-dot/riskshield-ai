# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 目标
话术、资料、模板、FAQ、培训、素材和 Telegram 文案通过后台更新，无需 Codex 改代码或重新部署。

## Collections
copy、template、resource、training、faq、telegram、recruitment、asset。

## 模型
ContentItem=逻辑身份；ContentVersion=不可变版本；ContentBlock=heading/paragraph/list/callout/commission table/CTA/disclosure/FAQ/image/video/dynamic variable。

## 继承
Platform Default → Program → Country → Channel。子层可覆盖，不能取消 Anti-Spam、披露、Stop Contact 等核心底线。

## 工作流
Draft → Preview → Validation → Review → Approve → Schedule/Publish → Supersede/Deprecate/Archive。发布后新版本，不覆盖。

## 后台
Copy、Template、Resource、Training、FAQ、Telegram、Assets、Localization、Import/Export、Dependency/Impact。

## Impact Checker
规则变化列出 Public、Portal、Calculator、FAQ、Training、Quiz、Recruitment、6 条 Telegram、外部素材；逐项 Updated/Not affected/Scheduled/Blocked。未完成不得发布规则。

## 变量
佣金、期限、官网、邮箱等动态引用。任何 unresolved/undefined 拒绝发布。

## 搜索/分析
Program、Channel、Audience、Funnel、Locale、Status、Tag、最近更新、复制、投诉、归因。只记录复制事件，不收集私人聊天正文。

## 权限
Content Editor、Compliance Reviewer、Program Manager、Publisher、Super Admin。当前可同一人，但代码分权。

## Emergency Deprecate
立即停止展示/复制/API 返回，保留历史，生成影响清单和 Telegram 同步提醒。
