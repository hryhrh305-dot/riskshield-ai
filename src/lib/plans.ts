export const plans = {
  free: { name: "Free", price: 0, monthlyLimit: 1000 },
  starter: { name: "Starter", price: 19, monthlyLimit: 50000 },
  growth: { name: "Growth", price: 49, monthlyLimit: 200000 },
  business: { name: "Business", price: 199, monthlyLimit: 1000000 },
} as const;

export type PlanKey = keyof typeof plans;

export function getPlanLimits(plan: string) {
  return plans[plan as PlanKey] ?? plans.free;
}
