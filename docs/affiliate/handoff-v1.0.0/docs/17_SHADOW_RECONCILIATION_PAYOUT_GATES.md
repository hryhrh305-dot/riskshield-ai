# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## Shadow
读取真实或模拟事件完整计算，但不显示 Payable、不生成真实 Payout、不发喜报、不影响主 Payment。Admin 查看 Primary、Audit、人工预期。

## 最低样本
30 笔；12 基础组合；5 refunds；2 chargebacks；3 referrals；2 accelerators；2 team tiers；1 rule switch；1 payout freeze；100 duplicate webhook；2 concurrent runs；1 Telegram unknown delivery。

## 每日对账
decisions=ledger+adjustments；payable=releases-reversals；batch=item total；paid≤approved；一个 sale 一个 base；一个 B 一个 referral；leader/月一个最高 team；Primary=Audit；no cross-program；无无法解释负余额。

异常：Critical Incident、暂停 Payout Creation/Execution、主支付继续、Portal 只读、管理员告警，不自动修余额。

## Payout Gate
Payable、identity verified、payout verified、72h freeze passed、无高风险案、reconciliation passed、audit matched、batch hash valid、admin reauth、PIN、$50、flag enabled。

## Batch
cutoff、snapshot、immutable items、hash、approve、processing、provider evidence、paid、Telegram notice。修改必须取消旧批次并新建。
