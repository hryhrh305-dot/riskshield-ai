# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 资产
佣金资金、Payout 账户、Rule Version、Ledger、Attribution、Affiliate KYC/PAN、客户身份、Telegram Token、Admin 权限、Content approval、Audit log。

## Spoofing
伪造 Affiliate ID/Admin/Bot/Webhook。控制：服务端 Auth、签名、Secret、Reauth、RLS、最小权限。

## Tampering
改金额、规则、Paid、Batch、归因。控制：不可变版本、只追加账本、Batch Hash、Audit、DB constraints。

## Repudiation
否认规则接受、调整或付款。控制：Policy acceptance、Content Version、Operator、Correlation ID、不可变 Audit。

## Disclosure
跨 Program、Leader 读敏感、Token 日志、喜报泄露客户。控制：RLS、DTO、PII 最小化、Secret Scan、Consent。

## DoS
重复 webhook、申请洪水、Telegram retry storm、对账锁。控制：Rate Limit、Idempotency、Queue、Backoff、Kill Switch。

## Privilege Escalation
普通用户 Admin、Editor 自发、Leader 改团队、Affiliate 改 Payable。控制：Server Authorization、Role、RLS、Command Allowlist。

## 业务滥用
自购、关联方、拆单、重注册、月末冲档退款、多代、Cookie Stuffing、隐藏跳转、Spam、伪造喜报。全部映射到对抗测试。

## 日志
不得记录完整 PAN、银行、Payout PIN、Bot Token、Service Role、客户支付、私聊正文。使用 Hash、Token、末四位、事件 ID。
