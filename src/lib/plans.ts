export interface PlanConfig {
  name: string;
  price: number;
  priceLabel: string;
  monthlyLimit: number;
  dailyLimit: number;
  maxTokensPerRequest: number;
  perMinuteLimit: number;
  ipPerMinuteLimit: number;
  batchLimit: number;
  teamMembers: number;
  apiAccess: boolean;
  tagline: string;
  description: string;
  creditsLabel: string;
  badge?: string;
  contactOnly?: boolean;
}

export const plans = {
  free: {
    name: "Free",
    price: 0,
    priceLabel: "$0",
    monthlyLimit: 50,
    dailyLimit: 5,
    maxTokensPerRequest: 0,
    perMinuteLimit: 0,
    ipPerMinuteLimit: 10,
    batchLimit: 1,
    teamMembers: 1,
    apiAccess: false,
    tagline: "Explore essential email risk signals",
    description: "Essential risk checks for evaluating individual contacts.",
    creditsLabel: "50 credits / month",
  },
  starter: {
    name: "Starter",
    price: 49,
    priceLabel: "$49",
    monthlyLimit: 1000,
    dailyLimit: 300,
    maxTokensPerRequest: 0,
    perMinuteLimit: 0,
    ipPerMinuteLimit: 20,
    batchLimit: 1000,
    teamMembers: 1,
    apiAccess: false,
    tagline: "For regular list cleaning",
    description: "Deeper email verification and practical bulk-list workflows.",
    creditsLabel: "1,000 credits / month",
  },
  growth: {
    name: "Growth",
    price: 249,
    priceLabel: "$249",
    monthlyLimit: 5000,
    dailyLimit: 1500,
    maxTokensPerRequest: 4000,
    perMinuteLimit: 30,
    ipPerMinuteLimit: 60,
    batchLimit: 5000,
    teamMembers: 3,
    apiAccess: true,
    tagline: "Best value for outbound teams",
    description: "Complete risk intelligence and automation for growing teams.",
    creditsLabel: "5,000 credits / month",
    badge: "MOST POPULAR",
  },
  scale: {
    name: "Scale",
    price: 1499,
    priceLabel: "$1,499",
    monthlyLimit: 30000,
    dailyLimit: 8000,
    maxTokensPerRequest: 8000,
    perMinuteLimit: 120,
    ipPerMinuteLimit: 240,
    batchLimit: 30000,
    teamMembers: 10,
    apiAccess: true,
    tagline: "For production-scale operations",
    description: "Higher throughput and operational capacity for demanding workflows.",
    creditsLabel: "30,000 credits / month",
  },
  business: {
    name: "Business",
    price: 0,
    priceLabel: "Contact us",
    monthlyLimit: 100000,
    dailyLimit: 25000,
    maxTokensPerRequest: 16000,
    perMinuteLimit: 300,
    ipPerMinuteLimit: 600,
    batchLimit: 100000,
    teamMembers: 25,
    apiAccess: true,
    tagline: "Built around enterprise requirements",
    description: "Custom capacity, onboarding, governance, and commercial terms.",
    creditsLabel: "100,000+ credits / month",
    contactOnly: true,
  },
} as const satisfies Record<string, PlanConfig>;

export type PlanKey = keyof typeof plans;

export function getPlanLimits(plan: string) {
  return plans[plan as PlanKey] ?? plans.free;
}

const planRank: Record<PlanKey, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  scale: 3,
  business: 4,
};

export function getPlanRank(plan: string): number {
  return planRank[plan as PlanKey] ?? 0;
}

export function isPlanAtLeast(plan: string, minimumPlan: PlanKey): boolean {
  return getPlanRank(plan) >= planRank[minimumPlan];
}

export function hasApiAccess(plan: string): boolean {
  return getPlanLimits(plan).apiAccess;
}

export function isContactOnlyPlan(plan: string): boolean {
  return !!getPlanLimits(plan).contactOnly;
}
