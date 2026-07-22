# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 多层防线
Payment Authenticity → Eligibility → Attribution → Canonical Customer → Anti-Abuse → Primary → Immutable Decision → Ledger → 30/60 Review → Independent Audit → Reconciliation → Payout Gate → Human Approval。

## 三层幂等
Provider Event；Sale+Reward+Rule；业务奖励（B首单、Leader月奖、Accelerator月奖、Telegram Publication）。应用层和 DB 唯一约束同时存在。

## 并发
事务中原子 claim/lock sale、校验、insert unique decision、ledger、outbox。冲突返回已有结果，不重复。

## 自购/关联
强阻断：同用户、canonical identity、付款/Payout/税务身份、同法人、推广员控制客户、盗刷。
风险信号：同 IP/设备/域名、短转化、多账号、退款聚集、资料相似、频繁换收款。单一 IP 不自动定罪。

## 首单唯一
续费、升级、降级、月转年、取消重订、换邮箱、同公司第二账号、重新 Checkout 不产生第二次。

## 一代
DB、Domain、Query、Test 四层保证 depth=1，A 只看 B，C 属于 B，团队查询不递归。

## Ledger
只追加 Base、Accelerator、Referral、Team、Cold Start、Reserve Release、Reversal、Clawback、Adjustment。禁止 UPDATE amount/DELETE。

## Audit Calculator
不得调用 Primary 的核心计算函数。付款前比较，不一致：Critical Incident + 暂停 Payout Creation/Execution。

## 管理员
无“直接改余额”。Adjustment 需要 reason/evidence/sale/amount/reauth/PIN/audit，高额二次审批策略。

## Kill Switch
Attribution Writes、Commission Generation、Team、Payout Creation、Payout Execution、Telegram、Wins、Daily Scripts 独立关闭。Affiliate 关闭不影响主业务。
