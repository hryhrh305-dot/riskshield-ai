# Secwyn India Affiliate Full Implementation

- Package version: v1.0.0
- Package date: 2026-07-22
- Target repository: `D:\ai-saas-mvp`
- Execution: **single Agent only**
- Delivery: full implementation, full local/Preview validation, Shadow Mode readiness, HumanOps-gated production activation
- Safety: fail closed, immutable rules and ledger, no real payout or production enablement without explicit HumanOps approval


## 当前状态
| Slot | Published | Pinned |
|---|---:|---:|
| Welcome | Yes | Yes |
| Anti-Scam | Yes | Yes |
| Commissions | Yes | No |
| Activation | Yes | No |
| Channel Rules | Yes | No |
| Attribution | Yes | No |

系统导入以下文本，但不得假装已有 message_id；HumanOps 后补。

## TG_SECWYN_INDIA_WELCOME

```text
Welcome to Secwyn India Affiliate Updates

This is the official Telegram channel for Secwyn’s India Affiliate Program.

Here you will receive:

• Official commission updates;
• Approved promotion scripts;
• Affiliate rules and compliance guidance;
• Activation and training instructions;
• Payment and qualification notices;
• Product updates relevant to affiliates;
• Anti-scam alerts.

Important disclosures:

• This is an independent commission-only opportunity;
• There is no base salary;
• There is no guaranteed income;
• There is no joining fee;
• No product purchase is required;
• Secwyn does not collect application payments through Telegram;
• Cold email, automated DMs and spam are prohibited.

Official website:
https://www.secwyn.com

Official support:
support@secwyn.com
```

## TG_SECWYN_INDIA_ANTI_SCAM

```text
Secwyn Anti-Scam Notice

Secwyn will never:

• Charge a joining fee;
• Require you to purchase a product to become an affiliate;
• Ask for your password or Payout PIN;
• Ask you to transfer money through Telegram;
• Guarantee monthly earnings;
• Ask you to send cold email or spam;
• Ask you to submit banking information in a Telegram chat;
• Ask you to pay an administrator through UPI, crypto or gift cards.

Use only the official Secwyn website and support email:

https://www.secwyn.com
support@secwyn.com

Affiliate applications and payout settings must be completed only through the official Secwyn website.
```

## TG_SECWYN_INDIA_COMMISSIONS

```text
Secwyn India Affiliate Launch Commissions

Commission is paid only for a qualified customer’s first successful subscription payment.

Starter
Monthly subscription: $25 commission
Annual subscription: $120 commission

Growth
Monthly subscription: $100 commission
Annual subscription: $600 commission

Scale
Monthly subscription: $300 commission
Annual subscription: $1,500 commission

Important:

• No commission is paid for views, likes, clicks or free registrations;
• All commissions are subject to attribution, qualification, refund and fraud review;
• Renewals and later plan changes do not create a second first-sale commission;
• USD is the official accounting currency;
• Approximate INR values may be displayed for reference;
• Earnings are not guaranteed.
```

## TG_SECWYN_INDIA_ACTIVATION

```text
How to Become an Approved Secwyn Affiliate

Step 1
Complete the short product and policy confirmation.

Step 2
Enter the seven-day Provisional Affiliate period.

Step 3
Complete three qualified promotional actions using at least two approved formats.

Examples:
• One relevant social media post;
• One relevant one-to-one professional conversation;
• One approved community share;
• One product demonstration;
• One manual B2B call;
• One valid referral registration.

Step 4
Unlock Approved Affiliate status.

A Provisional Affiliate may also be approved early after generating:
• A valid referral registration;
• A verified sales opportunity;
• A successful first customer payment.

No joining fee.
No required purchase.
No guaranteed income.
```

## TG_SECWYN_INDIA_CHANNEL_RULES

```text
Secwyn Approved Promotion Channels

Allowed:
• Relevant one-to-one LinkedIn or X conversations;
• Organic social media content;
• Product demonstrations and tutorials;
• Permitted professional communities;
• Relevant WhatsApp or Telegram conversations;
• Manual B2B telephone calls;
• Existing professional relationships.

Prohibited:
• Cold email;
• Automated direct messages;
• Bulk WhatsApp or Telegram messages;
• Scraped contact lists;
• Robocalls or prerecorded calls;
• Brand impersonation;
• PPC bidding on Secwyn brand terms;
• Misleading product or income claims;
• Repeated contact after someone asks you to stop.

Secwyn affiliates must always promote honestly and respect Stop Contact requests.
```

## TG_SECWYN_INDIA_ATTRIBUTION

```text
Secwyn Affiliate Attribution Rules

Click-to-registration window:
A customer must create a Secwyn account within 30 days after a qualifying referral-link click.

First-payment window:
An attributed customer must complete their first qualifying payment within 90 days after registration.

A documented active B2B sales opportunity may receive one administrator-approved extension of up to 30 additional days.

Important:
• Renewals do not create another first-sale commission;
• Switching from monthly to annual billing does not create a second commission;
• Refunds, chargebacks, fraud and incorrect attribution may cancel or reverse commission;
• Referral attribution cannot be manually transferred without a valid review.
```

## 同步
佣金、Launch/Evergreen、激活、渠道、归因、Payout、Anti-Scam、Bot identity 变化必须触发 Impact Checker。前两条只有 Bot 真实创建后才加入 Bot 用户名。
