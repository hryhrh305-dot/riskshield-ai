# RiskShield Growth Rules

## 1. Product positioning

RiskShield AI 在第一阶段不应再被包装成普通的 email verification、email checker、basic cleaning 或 cheap validation。

第一阶段主战场是：

- Pre-send List Audit
- Outbound List Intelligence
- Campaign Readiness Score
- Agency-ready Campaign Risk Report
- Client-ready Campaign Risk Report

目标客户：

- outbound agency
- cold email agency
- lead generation agency
- RevOps / Sales Ops team

核心价值不是“valid / invalid”。
核心价值是把名单变成明确的发送决策和客户可交付报告。

## 2. Free Preview rules

Free Preview 的目标是让用户快速理解名单审计流程，但不能把完整能力免费透出。

规则：

- 免费活动页路径：`/agency/free-list-audit`
- 这是 cold email outreach 专用 landing page，不是主站首页
- 最多上传或解析 500 contacts
- 只审计前 30 个 unique contacts
- 不做复杂抽样
- 首版透明规则是：`We review the first 30 unique contacts for free.`
- 剩余 contacts 只显示 pending / locked
- 后端不能在完整名单审计后隐藏结果
- 前端不能用 CSS blur 假装返回完整结果
- 后端只返回前 30 条真实结果，剩余只返回数量和 placeholder

## 3. Billable contact rules

Billable contact 指成功解析出来的唯一 email candidate。

规则：

- 空行不计费
- 没有邮箱的行不计费
- 完全重复邮箱不重复计费
- 大小写不同但邮箱相同，算同一个
- 格式明显有误但仍能解析出一个 email candidate 的，进入审计结果
- CSV 行数不等于 billable contacts
- 重复行可提示 duplicate warning，但不重复扣量

## 4. Free report rules

Free report 必须包含：

- Campaign Readiness Score
- Launch Decision
- Send / Review / Suppress summary
- Top 3 risk reasons
- 前 30 条联系人风险明细
- Basic PDF summary
- Basic CSV summary
- RiskShield branding

Free report 必须锁定：

- 第 4-5 个 risk reasons
- 第 31 条之后联系人明细
- 完整 row-level CSV
- 完整 PDF / HTML report
- 无水印报告
- Agency / client branding
- 历史报告保存
- 客户项目管理
- 批量导出
- 更高 contacts limit

## 5. Free CSV restrictions

Free CSV 不能是可直接导入 Smartlead / Instantly / Apollo 的完整干净名单。

Free CSV 只能是：

- summary CSV
- 或脱敏样本 CSV

Free CSV 可以包含类似字段：

- decision,total_contacts,percentage
- masked_email,risk_score,decision,risk_category

Free CSV 不允许提供：

- 完整 email
- 完整 send list
- 完整 suppress list
- 完整 row-level clean CSV
- 可直接导入发信工具的干净名单

## 6. Full paid report rules

付费版才允许：

- 完整名单审计
- 完整 Send / Review / Suppress decisions
- 完整 row-level CSV
- 完整 PDF report
- 完整 HTML report
- White-label / agency branding
- Client-ready report
- 历史报告
- 客户项目管理
- Suppression List 批量写入 / 导出

## 7. Report wording truthfulness

不要写这类不准确文案：

- `470 contact-level decisions are locked`
- `2 more risk reasons detected`
- `$847 additional waste identified`
- `35% unlocked`

更推荐写法：

- `470 additional contacts are waiting for full audit.`
- `Unlock full audit to generate decisions for the remaining contacts.`
- `Full-list estimated waste will be calculated after the full audit.`
- `Free Preview`
- `30 / 500 contacts reviewed`
- `470 contacts pending full audit`
- `Core summary unlocked`
- `Full contact-level audit locked`

## 8. Pricing language rules

前台不要写：

- `$0.1/contact`
- `cheap`
- `bulk email cleaning`

前台使用：

- audit capacity
- monthly audit capacity
- top-up credits
- bonus audit capacity
- referral credits
- extra client-ready report credits
- client-ready reports
- campaign audit capacity

## 9. Plan and product rules

Free Preview:

- $0
- upload up to 500 contacts
- audit first 30 unique contacts
- basic PDF summary
- basic CSV summary
- RiskShield branding

Small Campaign Risk Report:

- $19 one-time
- up to 120 contacts audited
- full contact-level decisions
- row-level CSV export
- PDF decision report
- RiskShield branding
- no white-label
- no report history
- no client folders

Founder Starter:

- $49 / month
- 500 contacts audited / month
- 3 client-ready reports / month
- full row-level CSV export
- PDF / HTML report
- white-label / agency branding
- report history
- client project folders

Growth:

- Growth and above open API Access
- Growth and above open Google Sheets integration

Scale:

- higher capacity
- higher API / Sheets usage
- Growth+ entry tier

注意：

- 如果 runtime 里仍使用 `starter` plan id，不要在本轮改成 `founder_starter`
- `Founder Starter` 只是商业包装命名或后续命名方向

## 10. Top-up and extra report rules

Top-up 只允许 active subscribers 购买。

Free 用户、Small Report 用户、未订阅用户不能购买 top-up。

Contacts top-up：

- +100 contacts, $15
- +250 contacts, $35
- +500 contacts, $65
- 有效期 60 天

Extra client-ready reports：

- +1 extra client-ready report, $15
- +3 extra client-ready reports, $39
- 有效期 60 天

Top-up 不能解锁：

- API
- Google Sheets
- Growth-only features
- Scale-only features

## 11. Referral rules

邀请奖励不发现金。
不能提现吗。
不做账户余额提现。
只发产品内额度。

规则：

- 新用户通过邀请链接注册并首次付费后，获得 +100 bonus contacts
- 奖励有效期 60 天
- 被邀请人首次付费成功且 14 天内没有退款、拒付、欺诈或可疑关联后，邀请人获得 +100 referral bonus contacts
- 奖励有效期 60 天
- 每个账户每月最多 5 次普通邀请奖励
- 每成功邀请 3 个付费用户，邀请人额外获得 +1 extra client-ready report credit
- 奖励不可提现，只能用于 RiskShield 内部 audit / report

风控：

- 免费注册不触发奖励
- 只有首次付费用户才触发奖励
- 退款、拒付、欺诈、同付款方式、同公司、明显自邀、可疑关联不发奖励
- 每个账户每月最多 5 次普通邀请奖励

## 12. Credit consumption order

所有 contacts credits 和 report credits 都必须按 `expires_at` 最近优先消耗。

也就是：

- 优先消耗最早过期的额度
- 按 `expires_at` 从近到远扣除
- 避免新额度先被扣、旧额度过期浪费

订阅额度：

- 按月重置
- 不结转
- 到新账单周期恢复套餐额度

Top-up：

- 60 天有效
- 可跨账单周期使用

Referral：

- 60 天有效
- 可跨账单周期使用

## 13. Refund, dispute, and cancellation rules

取消订阅：

- 当前账单周期结束前仍可使用订阅额度
- 到期后不再发放新月额度
- 已购买且未过期的 top-up 可以继续使用到 60 天过期

退款 / 拒付：

- 撤销该订单产生的未使用 credits
- referral reward 不发放
- 如果已经发放但发现欺诈，标记 revoked
- MVP 不需要复杂 negative balance，但不能继续发放异常奖励

## 14. Suppression List rules

面向用户界面优先叫：

- Suppression List
- Do-not-send List

不要优先叫：

- Blacklist

规则：

- 系统推荐 Suppress
- 用户确认后，才加入当前 user/workspace 的 Suppression List
- 后续同 user/workspace 上传时命中
- 结果 reason 显示：
  - `Previously suppressed by your workspace.`
- 用户可以查看、移除、导出
- 不写 global blacklist

禁止：

- 自动把高风险联系人写入全局 blacklist
- 未经用户确认就加入 Suppression List
- 把 Review 联系人自动加入 Suppression List
- 把 locked contacts 加入 Suppression List
- 用户 A 的 suppression 影响用户 B

## 15. API Access and Google Sheets rules

API Access 只允许 Growth 及以上订阅使用。

Google Sheets integration 只允许 Growth 及以上订阅使用。

不允许：

- Free
- One-time Small Report
- Founder Starter / Starter
- 独立 top-up 用户

Top-up 只是补充额度，不能解锁 API / Sheets。

API 和 Sheets 必须共用网站 Web 端同一套规则：

- credits ledger
- 订阅额度
- top-up
- extra report credits
- referral credits
- 60 天有效期
- expires_at 最近优先扣除
- report retention
- Suppression List
- 风控限制
- 数据安全规则

## 16. Report retention rules

Free report：

- report link 有效 14 天
- 原始上传数据 7 天后删除
- summary 可保留 14 天

付费 report：

- 订阅有效期间保留
- 取消订阅后保留 30 天供导出
- 到期后可只保留 summary 或删除原始联系人明细

## 17. Security rules

必须保持：

- report 页面不能被 Google 收录
- report token 不可猜
- 用户邮箱数据不能暴露在 URL
- locked data 不能真实渲染到前端再 CSS blur
- PDF 里不能把真实 locked data 放到底层
- 免费 preview 后端只返回前 30 条真实数据
- 剩余 locked 区域只返回数量和 placeholder

## 18. Send Report email rules

用户点击 Export / Send Report 后：

- 默认只要求输入邮箱
- 不强制注册
- 可选勾选：
  - `Save this report to a free RiskShield account`
- 勾选后才展开：
  - password
  - confirm password
- 按钮变为：
  - `Send Report & Create Free Account`

邮件建议：

- 一封邮件为主
- 主按钮：View Your Report
- 次按钮：Download Basic PDF
- 不要直接把大附件作为主流程，避免影响邮件送达和转化

## 19. Event tracking rules

至少记录：

- landing_page_view
- upload_started
- upload_completed
- preview_generated
- export_clicked
- email_submitted
- account_option_checked
- report_email_sent
- report_viewed
- unlock_clicked
- checkout_started
- payment_completed
- topup_purchased
- referral_link_copied
- referral_signup
- referral_paid

如果没有第三方分析平台，首版可以写入数据库 event log。

## 20. Current implementation status

已存在：

- Creem checkout / webhook
- subscription status
- profiles credits_remaining
- usage_ledger
- API gating
- Google Sheets endpoint / Apps Script
- bulk-check / list audit
- CSV export
- HTML audit report preview

缺失或未产品化：

- 独立 report credits
- credit grants / credit usage ledger
- expires_at 型 credits
- top-up credits
- referral credits
- free preview report token
- noindex report page
- report link expiry
- raw upload retention
- guest report email
- optional account creation
- user/workspace-level Suppression List

高风险：

- 现有 blacklist 更像 global blacklist
- 代码中使用的一些表名未在 SQL 文档里完整确认
- fallback env / URL 可能掩盖生产配置错误
