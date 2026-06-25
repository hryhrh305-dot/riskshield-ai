# Creem Production切换检查清单

这份清单用于把 RiskShield AI 的支付环境从 Test Mode 切到 Production。  
目标是：不重写支付系统，只确认当前代码路径、环境变量、Creem 控制台和线上验证都已经对齐。

## 1. 先确认代码层已经支持生产切换

当前代码里已经有这几条关键路径：

- `src/lib/creem.ts`
  - `CREEM_ENV=production` 时走 `https://api.creem.io/v1`
  - `CREEM_ENV=test` 时走 `https://test-api.creem.io/v1`
  - 如果不填 `CREEM_ENV`，会继续按 `CREEM_API_KEY` 前缀兜底判断
- `src/app/api/create-checkout/route.ts`
  - 读取当前用户
  - 按 plan 读取对应 product_id
  - 使用 `success_url / cancel_url / webhook_url`
  - 创建 checkout session
- `src/app/api/payment/webhook/route.ts`
  - 校验 `creem-signature`
  - 按 product_id 映射 starter / growth / scale
  - 写入 `subscriptions`
  - 更新 `profiles.plan`、`profiles.subscription_status`、credits
- `src/app/(dashboard)/pricing/page.tsx`
  - 走 `/api/create-checkout`
- `src/app/(dashboard)/dashboard/billing/success/page.tsx`
  - 展示支付成功后的同步状态

结论：代码结构上已经支持切生产，主要风险在环境变量和 Creem 控制台配置。

## 2. Vercel Production 必填环境变量

在 Vercel 的 Production 环境里确认这些变量都是真正的生产值：

```text
CREEM_ENV=production
CREEM_API_KEY=production key
CREEM_WEBHOOK_SECRET=production webhook secret
CREEM_STARTER_PRODUCT_ID=production Starter product id
CREEM_GROWTH_PRODUCT_ID=production Growth product id
CREEM_SCALE_PRODUCT_ID=production Scale product id
NEXT_PUBLIC_APP_URL=https://www.574269.xyz
```

### 建议标记为 Sensitive

```text
CREEM_API_KEY
CREEM_WEBHOOK_SECRET
SUPABASE_SERVICE_ROLE_KEY
DEEPSEEK_API_KEY
```

### 一般不需要标记为 Sensitive

```text
CREEM_ENV
CREEM_STARTER_PRODUCT_ID
CREEM_GROWTH_PRODUCT_ID
CREEM_SCALE_PRODUCT_ID
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

## 3. Creem Production 里必须重新创建的内容

Production 和 Test Mode 是隔离的，不能混用。

需要确认：

- 已在 Production 环境创建 `Starter`
- 已在 Production 环境创建 `Growth`
- 已在 Production 环境创建 `Scale`
- 已把这三个产品的 production `product_id` 复制到 Vercel
- 已创建 production webhook endpoint
- 已复制 production webhook secret 到 Vercel
- 已确认生产 API key 不是 test key

## 4. Webhook 需要检查的点

Webhook URL 应该是：

```text
https://www.574269.xyz/api/payment/webhook
```

检查项：

- webhook 路由是否正确
- 是否验证 `creem-signature`
- 是否使用 production webhook secret
- 是否读取 raw body
- 是否部署在 Node.js runtime，而不是 Edge runtime
- 是否把 product_id 正确映射到 starter / growth / scale
- 是否正确更新 Supabase：
  - `subscriptions`
  - `profiles.plan`
  - `profiles.subscription_status`
  - `profiles.credits_remaining`
  - `payments`

## 5. Production 切换顺序

推荐顺序：

1. 先确认代码逻辑没有还在强依赖 test 环境
2. 再在 Creem Production 创建正式产品
3. 再创建 production webhook
4. 再在 Vercel Production 切环境变量
5. 再重新部署
6. 再做一次真实 checkout 验证

## 6. 生产验证清单

### 购买前

- 打开 Pricing 页面
- 确认点击 Starter / Growth / Scale 会进入 checkout
- 确认不会提示 `Creem is not configured`
- 确认不会提示 `Missing Creem product mapping`

### 支付后

- 跳转到 `/dashboard/billing/success`
- 页面显示同步中或已同步
- webhook 成功后，dashboard plan 应切换到对应套餐
- credits 应更新为对应套餐额度
- `subscriptions` 表应出现对应订阅记录

### 失败排查顺序

如果支付成功但 Dashboard 没解锁，按这个顺序查：

1. Creem 是否真的创建了 production 订单
2. webhook 是否真的送到了 `api/payment/webhook`
3. webhook 是否 200 返回
4. `CREEM_WEBHOOK_SECRET` 是否正确
5. product_id 是否能映射到 starter / growth / scale
6. webhook 是否把数据写进了 `subscriptions`
7. dashboard 读取的是 `profiles.plan` 还是别的字段
8. API quota 是否按付费 plan 生效

## 7. 建议的最低风险烟雾测试

用一个极小折扣码或低成本产品做真实支付测试：

- 只测 Starter
- 真实走一次 checkout
- 真实触发 webhook
- 真实确认 dashboard 解锁

这样最容易发现：

- product_id 是否还在指向 test
- webhook 是否只是假成功
- dashboard 是否仍停留在 free

## 8. 这次切生产不要做的事

- 不要重写 billing 系统
- 不要新增隐藏测试入口
- 不要把 test product_id 混到 production
- 不要把 API key 暴露到浏览器
- 不要顺手改风控引擎

