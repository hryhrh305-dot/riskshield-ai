# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 可信输入
只接受已验证服务端 Payment Event、Customer、Canonical Identity、Product Snapshot、Actual Amount、Attribution、Membership、Direct Inviter、Rule Version、Risk/Refund、Program Clock。

前端不得传 amount、commission、affiliate_id、inviter、team、plan price、qualified、payable。

## 确定性顺序
1. 验证签名、环境、状态、幂等；
2. 查询实际金额、币种、Product；
3. canonical customer；
4. first qualified payment；
5. locked attribution；
6. membership；
7. self/related-party；
8. lock rule；
9. base；
10. annual schedule；
11. immutable decision；
12. pending ledger；
13. outbox；
14. month-end accelerator；
15. month-end team；
16. B 首单后 direct referral；
17. 30/60 release；
18. refund/chargeback reversal/clawback；
19. independent audit；
20. reconciliation → payout。

## 金额
USD cent + bigint，百分比高精度，HALF_UP；每项最终只舍入一次。Team 以实际销售额，MRR=实际年付/12，折扣按实际支付。

## Launch Base
Starter $25/$120；Growth $100/$600；Scale $300/$1,500。

## Evergreen Base
Starter $15/$100；Growth $75/$500；Scale $250/$1,200。

## Accelerator
Launch MRR ≥$500/1,500/5,000：5%/10%/15%。
Evergreen ≥$1,000/3,000/10,000：3%/6%/10%。
仅本人新单 Base，月结一次。

## Direct Referral
Launch：Starter $5/$15；Growth $20/$50；Scale $75/$150。
B Approved、真实首单、最终资格；A 当月至少 1 笔个人合格订单；同一 B 一次；仅 A→B。
Evergreen：实际合格销售额 0.5%，最高 $75。

## Team
只直属 B；不含 A/C/佣金奖金；A 当月 2 笔独立客户；只取最高档；月结、退款重算、不循环。

## Cold Start
Launch 可配置：30 天新人首单 $10；3 个直属 B 首单且 A 2 笔个人单 $30。Evergreen 关闭。

## 年付分期工程锁定
- Starter Annual：day 30、90，各 50%；
- Growth Annual：day 30、120、210、300，各 25%；
- Scale Annual：day 30、60、90、120、150、180，各 1/6；
- Evergreen 按同样期数结构均分，最后一期吸收余分，除非新 Rule Version 修改；
- 第一笔在 day30 释放 80%，余 20% day60；
- 订单年龄已≥60天的后续到期分期可 100%；
- 风险事件阻断。

如仓库已有更明确已上线政策，按冲突规则报告，不静默改变历史。
