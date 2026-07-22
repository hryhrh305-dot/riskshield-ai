# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 自动化案例

1. 同一 Creem webhook 重放 100 次，只产生一个 sale 和一组 ledger。
2. 两个 worker 同时处理同一 payment。
3. 前端篡改 amount、plan、affiliate_id、inviter_id。
4. Test Mode payment。
5. Pending checkout。
6. Product ID 非批准目录。
7. 金额与目录不一致。
8. 推广员本人购买。
9. 推广员第二账号购买。
10. 推广员关联公司购买。
11. 相同付款账户多个客户。
12. 相同 IP 但真实不同企业，不能仅凭 IP 没收。
13. 同一客户换邮箱重新购买。
14. 同一客户取消后重订。
15. 月付转年付。
16. Starter 升级 Growth。
17. Growth 升级 Scale。
18. 同一公司多账号。
19. 付款后补 Referral。
20. 清 Cookie 覆盖已锁定归因。
21. 管理员无证据改归因。
22. B 已有 A 又绑定 D。
23. A 读取或领取 C。
24. 递归团队查询。
25. 同一订单进入两个团队。
26. Leader 不满足 2 笔个人订单。
27. 两笔订单实际同一客户拆单。
28. 月底冲档后退款。
29. 团队奖多档叠加。
30. Accelerator 每笔重复发。
31. 跨月时区边界。
32. 年付 MRR 舍入边界。
33. Launch 截止时并发订单。
34. Rule Version 发布后修改。
35. 旧订单被新规则重算。
36. Starter 年付中途退款。
37. Growth 年付两期后拒付。
38. Scale 年付已付后 Chargeback。
39. 退款事件重放 100 次。
40. Clawback 超过未来余额。
41. 管理员直接 UPDATE ledger。
42. 普通用户调用 Commission Admin。
43. Leader 读取 B 的 KYC。
44. Secwyn 读取 Flowwyn 数据。
45. Content Editor 绕过审批。
46. Draft 内容被机器人发送。
47. Deprecated 话术被复制。
48. 模板变量 unresolved。
49. Telegram 模板硬写错误佣金。
50. 同一 Qualified Win 重放 100 次。
51. Telegram 成功但保存超时。
52. Pending sale 发喜报。
53. 无授权公开真实姓名。
54. Paid batch 对账失败却发通告。
55. Bot Token 出现在客户端/日志/错误。
56. Bot 失去权限。
57. Telegram Kill Switch。
58. Affiliate Kill Switch 影响主支付。
59. Payout 账户修改 72 小时内付款。
60. 重复点击 Payout。
61. 管理员重复执行 Payout Job。
62. 批准后静默改 Batch 金额。
63. 低于 $50 进入批次。
64. Suspended Affiliate 新归因。
65. Expired Affiliate 新佣金。
66. Stop Contact 后换渠道继续。
67. 违规处罚误删无关合法佣金。
68. Emergency Deprecate 后仍可复制。
69. Impact Checker 未完成却发布。
70. Migration 失败无法回滚。
71. Dead Letter 重放不幂等。

每个案例记录前置数据、命令、预期、实际、DB 断言、Audit 和清理。
