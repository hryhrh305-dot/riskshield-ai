# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 聚合
AffiliateProfile、AffiliateMembership、AffiliateAttribution、AffiliateSale、CommissionDecision、LedgerEntry、PayoutBatch、ContentItem/Version、TelegramPublication。

## Membership
```text
InterestedApplicant → PolicyConfirmed → ProvisionalAffiliate
→ ApprovedAffiliate → ActiveAffiliate
→ Suspended / ExpiredNoSale / Terminated
```

## Attribution
```text
Clicked → Registered → Locked → Converted / Expired / Invalidated
```

## Sale
```text
PaymentPending → PaymentVerified → QualificationReview → Qualified
→ Refunded / Chargeback / FraudInvalidated
```

## Commission
```text
Attributed → Pending → Qualified → RiskReserve → Scheduled
→ Payable → Paid → Reversed / Clawback
```

## Payout
```text
Draft → Approved → Processing → Paid / Failed / PartiallyPaid / Cancelled
```

## Content
```text
Draft → InReview → Approved → Scheduled → Published
→ Superseded / Deprecated / Archived
```

## Telegram Publication
```text
Draft → Queued → Rendering → Validated → Sending → Published
→ FailedRetryable / FailedPermanent / UnknownDelivery / Cancelled / Retracted
```

每次转换：校验状态/权限、原因、审计、领域事件、幂等、同事务 Outbox、不可覆盖历史、测试。
