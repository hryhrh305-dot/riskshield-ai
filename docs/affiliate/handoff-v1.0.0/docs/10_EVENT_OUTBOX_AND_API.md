# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 事件
CustomerRegistered、CheckoutPaid、RefundCreated、ChargebackCreated、ApplicationSubmitted、ProvisionalStarted、AffiliateApproved/Expired、AttributionLocked、SaleQualified、CommissionDecisionCreated/Qualified/Reversed、PayoutBatchPaid、ContentPublished、QualifiedWinReady、TelegramPublicationRequested/Succeeded/Failed、IntegrityIncidentOpened。

机器目录：`machine/27_EVENT_CATALOG.json`。

## Outbox
业务变化与 Outbox 同事务。Worker claim/process/success/retry/dead letter，携带 event_id、version、program_id、correlation、causation、idempotency。

## API
公开：landing、apply、referral、published content。
Affiliate：own profile/activation/ledger/payout/content/contact/questions/win consent。
Leader：直属 B 汇总。
Admin：applications/members/attribution/sales/commission/reconciliation/payout/content/telegram/compliance/rules。

## 安全
Server auth、schema、CSRF、rate limit、idempotency、无敏感日志、service role 不进客户端、Admin 不信客户端 claim、无任意表更新 API。

## Telegram Publishing Service
只接受 jobId、qualifiedSaleEventId、payoutBatchId、ruleVersionId、publicationId；不得接受任意金额/名字/消息直接发送。
