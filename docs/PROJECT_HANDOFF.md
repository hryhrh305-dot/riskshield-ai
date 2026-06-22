# Project Handoff — RiskShield AI

> 最后更新：2026-06-23
> 接手前请完整阅读本文档

---

## 1. 项目一句话定位

邮箱风险检测 / Pre-send Protection SaaS。
目标用户：做邮件营销、外贸获客、SaaS 冷启动的人。
核心价值：检测邮箱风险 + 保护发信域名信誉，不只是一个"邮箱验证工具"。

---

## 2. 当前技术栈

| 层 | 技术 | 备注 |
|---|---|---|
| 前端框架 | Next.js 16.2.9 (App Router) | Turbopack 构建 |
| 后端 | Next.js API Routes (Serverless) | 部署在 Vercel |
| 数据库 | Supabase (PostgreSQL) | project ref: njhjiavnidssjvnkcxfo |
| 鉴权 | Supabase Auth (内置) | Cookie-based SSR + 手动 token 验证 |
| 支付 | Creem (test 模式) | 上线前必须切 live |
| 部署 | Vercel | 项目名：riskshield-api（GitHub repo: riskshield-ai）|
| UI 库 | Tailwind CSS v4 + Lucide React icons | |
| AI | DeepSeek API | 用于风险解释（仅 score>=70 时调用）|
| XLSX | xlsx (SheetJS) | 批量检测 CSV/XLSX 导出 |

### 主要依赖

- @supabase/ssr ^0.12.0
- @supabase/supabase-js ^2.108.2
- next 16.2.9
- react 19.2.4
- openai ^6.44.0（包装 DeepSeek API）
- xlsx ^0.18.5
- lucide-react ^1.21.0
- tailwindcss v4
- stripe ^22.2.2（保留但当前用 Creem）

---

## 3. 目录结构说明

```
ai-saas-mvp/
├── docs/                          # 文档目录
│   ├── PROJECT_HANDOFF.md         # ← 本文档
│   ├── CHANGELOG.md               # 变更历史
│   ├── CURRENT_STATE.md           # 项目状态概览
│   └── TODO.md                    # 待办清单
│
├── google-sheets-addon/           # Google Sheets 插件（未完成）
│   ├── Code.gs                    # Apps Script 代码
│   └── README.md
│
├── public/                        # 静态资源
│
├── src/
│   ├── app/                       # Next.js App Router 页面
│   │   ├── (auth)/                # 登录/注册页面组
│   │   │   ├── login/page.tsx     # 登录页面
│   │   │   └── signup/page.tsx    # 注册页面
│   │   ├── (dashboard)/           # 仪表盘页面组
│   │   │   ├── dashboard/page.tsx # 主仪表盘（积分显示、Protection Settings开关、API Key管理）
│   │   │   ├── risk-check/page.tsx# 单条邮箱/IP风险检测
│   │   │   ├── bulk-check/page.tsx# 批量检测（CSV/粘贴）
│   │   │   ├── blacklist/page.tsx # 黑名单管理
│   │   │   └── pricing/page.tsx   # 定价页面
│   │   ├── api/                   # API 路由（全部 Serverless）
│   │   │   ├── web-risk/route.ts  # Web 工具检测（主入口）
│   │   │   ├── bulk-check/route.ts# 批量检测
│   │   │   ├── settings/route.ts  # Protection Settings 读写
│   │   │   ├── blacklist/route.ts # 黑名单管理
│   │   │   ├── migrate/route.ts   # 数据库迁移（已废弃，返回 DEPRECATED）
│   │   │   ├── create-checkout/   # Creem 支付结账
│   │   │   ├── payment/           # 支付 Webhook
│   │   │   ├── pre-send/route.ts  # Pre-send campaign 历史
│   │   │   ├── projects/route.ts  # 项目管理
│   │   │   └── v1/                # 对外 API 版本 1
│   │   │       ├── email/
│   │   │       │   ├── check/route.ts        # 单条邮箱检测
│   │   │       │   └── batch-check/route.ts  # 批量邮箱检测
│   │   │       ├── ip/check/route.ts         # IP 检测
│   │   │       ├── risk/check/route.ts       # 综合风险检测
│   │   │       └── pre-send/check/route.ts   # Pre-send 检测
│   │   ├── auth/callback/        # Supabase Auth 回调
│   │   ├── docs/page.tsx         # API 文档页面
│   │   ├── pre-send/page.tsx     # Pre-send 历史页面（当前 404）
│   │   ├── page.tsx              # 首页
│   │   └── middleware.ts         # 路由保护中间件
│   │
│   ├── lib/                      # 核心逻辑
│   │   ├── risk-engine.ts        # 评分引擎（核心：~1500行）
│   │   ├── supabase.ts           # 浏览器端 Supabase 客户端（单例）
│   │   ├── supabase-server.ts    # 服务端 Supabase 客户端
│   │   ├── auth.ts               # 登录/注册/登出工具函数
│   │   ├── api-auth.ts           # API Key 认证
│   │   ├── cost-control.ts       # 配额/限流控制
│   │   ├── blacklist.ts          # 黑名单逻辑
│   │   ├── disposable-domains.ts # 一次性邮箱域名列表（~15万行）
│   │   ├── ip-guard.ts           # IP 风险检测
│   │   ├── plans.ts              # 定价方案定义
│   │   ├── response.ts           # 统一响应格式
│   │   └── env.ts                # 环境变量助手
│   │
│   └── components/               # 共享组件（当前为空）
│
├── supabase-schema.sql           # 完整数据库 Schema
├── supabase-migration.sql        # 最近的迁移（加 credits_remaining、risk_settings 列）
├── AGENTS.md                     # AI 助手工作规则
├── .env.example                  # 环境变量模板
├── package.json
└── next.config.ts
```

---

## 4. 已完成功能

### 用户系统
- [x] 注册 / 登录（Supabase Auth）
- [x] 自动创建 profile（trigger on signup）
- [x] Middleware 路由保护（登录态检查）

### 风险检测引擎
- [x] 邮箱格式检查
- [x] 一次性邮箱检测（~15万域名）
- [x] MX/SPF/DMARC/DKIM DNS 查询
- [x] SMTP 验证（基础）
- [x] Catch-all 域名检测
- [x] 域名年龄查询（RDAP 协议）
- [x] 可疑 TLD 检测
- [x] IP 风险检测（代理/VPN/托管商）
- [x] 公司健康评分（Company Health Score）
- [x] DeepSeek AI 风险解释（score>=70时）
- [x] Role-based 邮箱检测
- [x] 域名关键词风险检测
- [x] 结果缓存（24h TTL，不重复扣积分）

### 评分模型
- [x] V2 评分引擎：正向信誉分 + 负向风险分
- [x] 最终评分范围 0-100
- [x] 决策：0-29 ALLOW / 30-59 REVIEW / 60-100 BLOCK
- [x] 独立的风险原因列表

### Web 工具页面
- [x] Dashboard（积分、计划、用量概览）
- [x] Risk Check（单条检测）
- [x] Bulk Check（批量检测：粘贴/CSV/XLSX上传）
- [x] 批量检测结果表格 + 汇总统计
- [x] 批量检测结果导出 CSV/XLSX
- [x] Protection Settings 开关（Block disposable / Block high risk / Review catch-all / Review new domain）
- [x] 黑名单管理页面
- [x] 定价页面（Free / Starter / Growth / Business）
- [x] API Docs 页面

### API (v1)
- [x] POST /api/v1/email/check
- [x] POST /api/v1/email/batch-check
- [x] POST /api/v1/ip/check
- [x] POST /api/v1/risk/check
- [x] POST /api/v1/pre-send/check
- [x] API Key 认证（x-api-key header）
- [x] Cost control（按计划限制月/日/分钟配额）

### 积分系统
- [x] profiles.credits_remaining 字段
- [x] consume_credit RPC 函数（TABLE 格式）
- [x] 积分不足检测（返回 429）

### 支付
- [x] Creem 结账创建（/api/create-checkout）
- [x] Creem Webhook（/api/payment/webhook）
- [x] 订阅状态管理

### 部署
- [x] Vercel 自动部署（GitHub push 触发）
- [x] 域名 574269.xyz（www 子域名）
- [x] Supabase 生产数据库

### 已修 bug（重要）
- [x] domainAgeDays 缺失解构参数导致 500（已加）
- [x] getSupabaseAdmin require() 替换为静态 import
- [x] getUserFromRequest 替换为 cookie 直接读取（去掉 @supabase/ssr 依赖）
- [x] middleware 添加 try-catch + 直接 cookie 读取
- [x] supabase.ts 改为单例模式（持久化 session）
- [x] dashboard 空 settings 崩溃（加 null check）
- [x] NO_CREDITS 误报（risk_settings 列不存在导致查询失败）
- [x] consume_credit RPC 函数重建（TABLE 格式对齐代码）

---

## 5. 未完成功能

- [ ] Pre-send campaign 历史页面（/pre-send 当前 404）
- [ ] Campaign Risk Report（批量检测后的完整报告）
- [ ] Custom Rules（企业级规则引擎，当前只有简单开关）
- [ ] Pre-send Hook API（发送前实时检查）
- [ ] Google Sheets 插件（google-sheets-addon/ 已创建但未部署）
- [ ] Slack 集成
- [ ] V8/V9 Sales OS
- [ ] AI SDR Copilot
- [ ] Lead Quality Score（更丰富的线索评分）
- [ ] Domain Health Dashboard
- [ ] SMTP 验证（代码中有预留但未完整实现）

---

## 6. 当前线上配置

| 项目 | 值 |
|---|---|
| 域名 | https://www.574269.xyz |
| Vercel 项目名 | riskshield-api |
| GitHub Repo | hryhrh305-dot/riskshield-ai (branch: main) |
| Supabase 项目 | njhjiavnidssjvnkcxfo.supabase.co |
| 支付 | Creem test 环境（未切 live）|
| 定价方案 | Free / Starter($49/mo) / Growth($149/mo) / Business($499/mo) |
| 认证账号 | hryhrh123@163.com / RiskShield2026! |
| 测试账号 | hryhrh8000@163.com / （密码未知）|

---

## 7. 环境变量清单

```
# Supabase（必须）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
DEEPSEEK_API_KEY=

# 支付（Creem）
CREEM_API_KEY=
CREEM_WEBHOOK_SECRET=
CREEM_PRODUCT_ID=

# 部署
NEXT_PUBLIC_APP_URL=https://574269.xyz
```

> ⚠️ Vercel 上的环境变量可能缺失或值与 .env.local 不一致。
> 之前 DEBUG 发现 Vercel 上 NEXT_PUBLIC_SUPABASE_ANON_KEY 可能为空导致 @supabase/ssr 崩溃。

---

## 8. 数据库状态

### 已有表（supabase-schema.sql）

| 表名 | 状态 | 说明 |
|---|---|---|
| profiles | ✅ 正常 | 用户资料、计划、积分 |
| api_keys | ✅ 正常 | API 密钥管理 |
| api_usage | ✅ 正常 | API 用量跟踪 |
| checks | ✅ 正常 | 检测记录 |
| subscriptions | ✅ 正常 | 订阅记录 |
| payments | ✅ 正常 | 支付记录 |

### 已额外添加的列（通过 migration + 手动 SQL）

- profiles.credits_remaining INTEGER DEFAULT 0
- profiles.total_checks INTEGER DEFAULT 0
- profiles.risk_settings JSONB（默认值: {"block_disposable":true,"block_high_risk":true,"review_catch_all":true,"review_new_domain":true}）
- profiles.credits_refreshed_at TIMESTAMPTZ

### 已创建的 RPC 函数

- consume_credit(p_user_id UUID) → TABLE(success boolean, remaining integer)
  - 必须 GRANT EXECUTE TO anon, authenticated, service_role
- handle_new_user()（trigger on auth.users INSERT）
- increment_api_usage(...)

### 潜在缺失的表

- scan_history（web-risk 中 try-catch insert，可能不存在但不影响功能）
- usage_ledger（cost-control 中引用，可能不存在）
- ip_requests（cost-control 中引用，可能不存在）
- pre_send_checks（pre-send 功能需要，可能不存在）

### RLS 注意事项

- profiles 只有 user 本人能读写（auth.uid() = id）
- API routes 使用 service_role key（绕过 RLS）
- 浏览器客户端使用 anon key（受 RLS 限制）
- 新表必须启用 RLS + 添加对应策略

---

## 9. 重要 API 路由

### Web 页面 API

| 路由 | 方法 | 用途 | 认证 | 备注 |
|---|---|---|---|---|
| /api/web-risk | POST | 单条检测 | Cookie | 积分-1 |
| /api/web-risk | GET | 检测历史 | Cookie | - |
| /api/bulk-check | POST | 批量检测 | Cookie | 走 cost-control |
| /api/settings | GET | 读 Protection Settings | Cookie | - |
| /api/settings | PUT | 写 Protection Settings | Cookie | - |
| /api/create-checkout | POST | Creem 结账 | Cookie | - |
| /api/payment/webhook | POST | Creem 回调 | 签名验证 | - |
| /api/pre-send | POST/GET | Pre-send 管理 | Cookie | 功能未完成 |
| /api/blacklist | GET/POST/DELETE | 黑名单 | Cookie | - |
| /api/migrate | GET | 迁移指引 | 无 | 已废弃，返回 DEPRECATED |

### 对外 API（v1）

| 路由 | 方法 | 用途 | 认证 | 备注 |
|---|---|---|---|---|
| /api/v1/email/check | POST | 单条邮箱检测 | x-api-key | - |
| /api/v1/email/batch-check | POST | 批量邮箱检测 | x-api-key | - |
| /api/v1/ip/check | POST | IP 检测 | x-api-key | - |
| /api/v1/risk/check | POST | 综合风险检测 | x-api-key | - |
| /api/v1/pre-send/check | POST | Pre-send 检测 | x-api-key | - |

---

## 10. 当前已知 Bug

### 🐛 P0（阻断）

**登录无反应**（当前活跃 bug）
- 现象：输入邮箱密码点 Sign In 按钮，页面没跳转
- 已确认：Supabase 返回 200 + access_token，但 data.session 可能为 null
- 已尝试修复：supabase.ts 改为单例模式
- 待验证：需要加 console.log 确认 data.session 是否 null
- 当前状态：page.tsx 中已加了 console.log，等部署后看输出

### 🐛 P1

**middleware 曾导致页面完全崩溃**
- 已修复：改为直接 cookie 读取 token + try-catch
- 当前状态：✅ 已修复，但需要验证 login 成功后 middleware 能正确读取 cookie

### 🐛 P2

**/api/migrate 端点返回 DEPRECATED**（这不是 bug，是废弃的 API）
**pre-send 页面 404**（页面存在但路由可能不匹配）
**多个 API route 还残留旧的 require() + createServerClient 写法**（需要统一清理）
- 包括：api/v1/*、api/pre-send、api/blacklist、api/create-checkout、api/projects、api/payment
**/pre-send 路由需要 pre_send_checks 表**（可能未创建）

---

## 11. 安全注意事项

- [ ] 不得提交 .env 文件、真实 API Key、service_role key 到 Git
- [ ] 所有支付 webhook 必须校验签名（当前 Creem webhook 已验证）
- [ ] 所有用户数据按 user_id 隔离（RLS 已配置）
- [ ] /api/migrate 已废弃不可再用（Vercel → Supabase 直连不可行）
- [ ] service_role key 泄露风险：代码中有 hardcoded fallback，生产环境必须用环境变量覆盖
- [ ] Creem test 密钥上线前必须切 live，否则真实验证会失败

---

## 12. 下一步开发优先级

### P0 — 必须优先修复
1. 登录跳转问题（加 log 确认 data.session 是否为 null）
2. 主流程端到端验证：登录 → 检测 → 积分消耗 → 结果展示

### P1 — 核心体验
3. Pre-send campaign 历史页面（创建 pre_send_checks 表 + 修复 /pre-send 路由）
4. Campaign Risk Report（批量检测后的完整报告）
5. 清理所有 API route 中残留的 createServerClient + require() 写法

### P2 — 差异化功能
6. Custom Rules（当前只有开关，升级为可配置规则）
7. Google Sheets 插件上线
8. Domain Health Dashboard

### P3 — 护城河
9. Pre-send Hook API
10. Slack / CRM 集成
11. AI SDR Copilot

---

## 13. 给新 Codex 的工作规则

1. **修改代码前先说明计划** — 告诉我你要改什么、为什么改、怎么改
2. **每次只改一个小目标** — 不要一次改 5 个文件，分步来
3. **修改后必须说明改了哪些文件** — 列清文件路径和改动内容
4. **必须给测试步骤** — 改完告诉我怎么测
5. **不要擅自大重构** — 重构前必须问我
6. **不要删除已有功能** — 有疑问先问我
7. **不要把 test payment 当 production** — Creem 仍是 test 模式
8. **GitHub 推送需要代理** — 设置 HTTP_PROXY=http://127.0.0.1:3067
9. **对话用中文，网站 UI 保持英文**
10. **提供完整文件内容，不要只贴 diff**
11. **每次 push 后提醒用户等 ~30s 让 Vercel 部署**
12. **不要用 xlsx 动态 import（在浏览器中会导致页面崩溃），用静态 import**

---

## 附录：当前活跃 Branch

Branch: main
最新 Commit: 559652e（fix: supabase client singleton pattern）
