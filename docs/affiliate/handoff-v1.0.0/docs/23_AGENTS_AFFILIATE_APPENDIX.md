# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


建议加入 AGENTS.md：

1. 单 Agent；
2. Money bigint/decimal；
3. 客户端不得传金额/Affiliate/资格；
4. Rule 和 Published Content 不可变；
5. Ledger 只追加；
6. 所有 money/payment/refund/payout/Telegram event 幂等；
7. 一代边界；
8. Program RLS；
9. 改佣金必须新 Rule + Golden；
10. 改规则必须 Impact + Telegram；
11. 6 条消息同步；
12. 真实操作 HumanOps；
13. Flags 默认关闭；
14. Critical/High 或完整性失败不得 PASS；
15. 不声称绝对无漏洞；
16. 不改 50 免费、Pricing、Entitlements、主业务；
17. 每次运行 tests/build/git status。
