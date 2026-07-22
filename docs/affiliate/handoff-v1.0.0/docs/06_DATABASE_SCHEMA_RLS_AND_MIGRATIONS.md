# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 原则
- 新对象统一 `affiliate_` 前缀；
- Program 数据全部带 `program_id`；
- 用户查询强制 RLS；
- Service Role 仅服务端；
- 财务表禁止用户直接写；
- 已支付、Ledger、Rule Version、Published Content、Audit 禁止 UPDATE/DELETE；
- 敏感资料最小化、Token 化；
- Migration 可回滚或可向前修复。

## 表
### Program / Rules
`affiliate_programs`、`affiliate_program_versions`、`affiliate_program_capabilities`、`affiliate_program_channels`

### Application / Membership
`affiliate_applications`、`affiliate_profiles`、`affiliate_memberships`、`affiliate_policy_acceptances`、`affiliate_quiz_attempts`、`affiliate_activation_actions`

### Attribution / Sales
`affiliate_links`、`affiliate_click_events`、`affiliate_attributions`、`affiliate_sales`、`affiliate_customer_identity_links`、`affiliate_attribution_adjustments`

### Team
`affiliate_referral_relationships`、`affiliate_team_months`、`affiliate_team_reward_decisions`

### Commission
`affiliate_commission_decisions`、`affiliate_commission_schedules`、`affiliate_ledger_entries`、`affiliate_commission_adjustments`、`affiliate_reconciliation_runs`、`affiliate_integrity_incidents`

### Payout
`affiliate_payout_accounts`、`affiliate_payout_security`、`affiliate_payout_batches`、`affiliate_payout_items`、`affiliate_payout_attempts`

### Compliance
`affiliate_compliance_cases`、`affiliate_policy_violations`、`affiliate_stop_contact_hashes`、`affiliate_audit_log`

### Content
`affiliate_content_items`、`affiliate_content_versions`、`affiliate_content_blocks`、`affiliate_content_dependencies`、`affiliate_content_approvals`、`affiliate_content_publications`、`affiliate_content_localizations`、`affiliate_content_assets`、`affiliate_content_asset_versions`、`affiliate_content_usage_events`、`affiliate_content_sync_targets`

### Telegram
`affiliate_telegram_bots`、`affiliate_telegram_channels`、`affiliate_telegram_schedules`、`affiliate_telegram_event_rules`、`affiliate_telegram_publication_jobs`、`affiliate_telegram_publications`、`affiliate_telegram_failures`、`affiliate_telegram_win_consents`、`affiliate_telegram_message_slots`

### Infrastructure
`affiliate_outbox_events`、`affiliate_dead_letter_events`、`affiliate_idempotency_records`

## 唯一约束
- `(provider, provider_event_id)`；
- `(program_id, sale_id, affiliate_id, reward_type, rule_version_id)`；
- 一个 Membership 一个 direct inviter；
- `relationship_depth = 1`；
- `(program_id, invitee_membership_id, first_sale_referral)`；
- `(program_id, leader_id, performance_month, reward_type)`；
- 一个 canonical customer 一个 first qualified payment；
- 一个 Sale 一个 Rule Version；
- Telegram：program + channel + type + source event + template version；
- Content：program + collection + slug + locale。

## RLS
普通用户仅可提交公开申请；Provisional 只读自己的精简内容/行动；Approved 只读自己 Program；Leader 只读直属 B 汇总，不能读 KYC/Payout/客户 PII/C；Content 角色职责分离；Admin 服务端授权并审计。

## Migration
Expand → Backfill → Adapter/Dual Read → Verify → Shadow → Switch → 后续版本 Contract。不得直接删除旧 Referral/Payment 对象。
