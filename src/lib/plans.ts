export const plans = {
  free: { name: "Free", price: 0, monthlyLimit: 1000, dailyLimit: 30, maxTokensPerRequest: 2000, description: "1,000 requests/month, 30/day" },
  starter: { name: "Starter", price: 19, monthlyLimit: 50000, dailyLimit: 2000, maxTokensPerRequest: 8000, description: "50,000 requests/month" },
  growth: { name: "Growth", price: 49, monthlyLimit: 200000, dailyLimit: 10000, maxTokensPerRequest: 16000, description: "200,000 requests/month" },
  business: { name: "Business", price: 199, monthlyLimit: 1000000, dailyLimit: 50000, maxTokensPerRequest: 32000, description: "1,000,000 requests/month" },
} as const;

export type PlanKey = keyof typeof plans;

export function getPlanLimits(plan: string) {
  return plans[plan as PlanKey] ?? plans.free;
}
