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

export interface ResultVisibility {
  detailTier: "free" | "starter" | "growth" | "scale";
  includeReasons: boolean;
  includeRecommendation: boolean;
  includeImpact: boolean;
  includeSolution: boolean;
  includeRiskFactors: boolean;
  includeEstimatedWasteCost: boolean;
  includeDomainAge: boolean;
  includeDnsHealth: boolean;
  includeCompanyHealth: boolean;
  includeAiExplanation: boolean;
  includeBasicEmailDetails: boolean;
  includeStarterEmailDetails: boolean;
  includeAdvancedEmailDetails: boolean;
  includeBasicIpDetails: boolean;
  includeAdvancedIpDetails: boolean;
}

export interface ExportColumn {
  key: string;
  label: string;
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
    tagline: "Try single-contact checks",
    description: "50 one-time single-contact checks with dashboard history.",
    creditsLabel: "50 one-time checks",
  },
  starter: {
    name: "Starter",
    price: 49,
    priceLabel: "$49",
    monthlyLimit: 500,
    dailyLimit: 300,
    maxTokensPerRequest: 0,
    perMinuteLimit: 0,
    ipPerMinuteLimit: 20,
    batchLimit: 500,
    teamMembers: 1,
    apiAccess: false,
    tagline: "For smaller outbound teams",
    description: "List audits, Send / Review / Suppress decisions, and basic summaries and exports.",
    creditsLabel: "500 contacts audited / month",
  },
  growth: {
    name: "Growth",
    price: 249,
    priceLabel: "$249",
    monthlyLimit: 2500,
    dailyLimit: 1500,
    maxTokensPerRequest: 4000,
    perMinuteLimit: 30,
    ipPerMinuteLimit: 60,
    batchLimit: 5000,
    teamMembers: 3,
    apiAccess: true,
    tagline: "Best value for agency delivery",
    description: "Agency-ready list intelligence, audit exports, and workflow handoff.",
    creditsLabel: "2,500 contacts audited / month",
    badge: "MOST POPULAR",
  },
  scale: {
    name: "Scale",
    price: 1499,
    priceLabel: "$1,499",
    monthlyLimit: 15000,
    dailyLimit: 8000,
    maxTokensPerRequest: 8000,
    perMinuteLimit: 120,
    ipPerMinuteLimit: 240,
    batchLimit: 30000,
    teamMembers: 10,
    apiAccess: true,
    tagline: "For high-volume agency operations",
    description: "High-throughput audits, reporting, and automation for demanding campaigns.",
    creditsLabel: "15,000 contacts audited / month",
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
    creditsLabel: "Custom contacts audited / month",
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

const resultVisibilityByPlan: Record<PlanKey, ResultVisibility> = {
  free: {
    detailTier: "free",
    includeReasons: false,
    includeRecommendation: false,
    includeImpact: false,
    includeSolution: false,
    includeRiskFactors: false,
    includeEstimatedWasteCost: false,
    includeDomainAge: false,
    includeDnsHealth: false,
    includeCompanyHealth: false,
    includeAiExplanation: false,
    includeBasicEmailDetails: true,
    includeStarterEmailDetails: false,
    includeAdvancedEmailDetails: false,
    includeBasicIpDetails: false,
    includeAdvancedIpDetails: false,
  },
  starter: {
    detailTier: "starter",
    includeReasons: true,
    includeRecommendation: true,
    includeImpact: false,
    includeSolution: false,
    includeRiskFactors: false,
    includeEstimatedWasteCost: false,
    includeDomainAge: false,
    includeDnsHealth: false,
    includeCompanyHealth: false,
    includeAiExplanation: false,
    includeBasicEmailDetails: true,
    includeStarterEmailDetails: true,
    includeAdvancedEmailDetails: false,
    includeBasicIpDetails: false,
    includeAdvancedIpDetails: false,
  },
  growth: {
    detailTier: "growth",
    includeReasons: true,
    includeRecommendation: true,
    includeImpact: true,
    includeSolution: false,
    includeRiskFactors: true,
    includeEstimatedWasteCost: true,
    includeDomainAge: true,
    includeDnsHealth: true,
    includeCompanyHealth: true,
    includeAiExplanation: false,
    includeBasicEmailDetails: true,
    includeStarterEmailDetails: true,
    includeAdvancedEmailDetails: true,
    includeBasicIpDetails: true,
    includeAdvancedIpDetails: false,
  },
  scale: {
    detailTier: "scale",
    includeReasons: true,
    includeRecommendation: true,
    includeImpact: true,
    includeSolution: true,
    includeRiskFactors: true,
    includeEstimatedWasteCost: true,
    includeDomainAge: true,
    includeDnsHealth: true,
    includeCompanyHealth: true,
    includeAiExplanation: true,
    includeBasicEmailDetails: true,
    includeStarterEmailDetails: true,
    includeAdvancedEmailDetails: true,
    includeBasicIpDetails: true,
    includeAdvancedIpDetails: true,
  },
  business: {
    detailTier: "scale",
    includeReasons: true,
    includeRecommendation: true,
    includeImpact: true,
    includeSolution: true,
    includeRiskFactors: true,
    includeEstimatedWasteCost: true,
    includeDomainAge: true,
    includeDnsHealth: true,
    includeCompanyHealth: true,
    includeAiExplanation: true,
    includeBasicEmailDetails: true,
    includeStarterEmailDetails: true,
    includeAdvancedEmailDetails: true,
    includeBasicIpDetails: true,
    includeAdvancedIpDetails: true,
  },
};

const BASIC_EMAIL_DETAIL_KEYS = [
  "isDisposable",
  "isRoleBased",
  "hasMX",
  "mxChecked",
  "mxStatus",
] as const;

const STARTER_EMAIL_DETAIL_KEYS = [
  "isCatchAll",
  "domainExists",
  "smtpChecked",
  "smtpValid",
  "smtpCode",
  "smtpMessage",
  "mailboxFull",
  "tempRejected",
  "permanentRejected",
  "mailboxStatus",
  "catchAllStatus",
  "decisionExplanation",
] as const;

const ADVANCED_EMAIL_DETAIL_KEYS = [
  "domain",
  "localPart",
  "hasSPF",
  "spfChecked",
  "spfStatus",
  "hasDMARC",
  "dmarcChecked",
  "dmarcPolicy",
  "dmarcStatus",
  "hasDKIM",
  "dkimChecked",
  "dkimSelector",
  "dkimStatus",
  "inboxProbability",
  "estimatedBounceRate",
  "senderReputationRisk",
  "mxRecords",
] as const;

const BASIC_IP_DETAIL_KEYS = [
  "country",
  "countryCode",
  "region",
  "city",
  "isp",
  "org",
  "asn",
  "isProxy",
  "isHosting",
  "highRiskCountry",
] as const;

const ADVANCED_IP_DETAIL_KEYS = [
  "zip",
  "lat",
  "lon",
  "timezone",
  "reverse",
  "mobile",
  "proxy",
  "hosting",
  "as",
  "asname",
] as const;

function pickDefinedKeys(source: Record<string, unknown> | null | undefined, keys: readonly string[]) {
  if (!source) return null;
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) {
      picked[key] = source[key];
    }
  }
  return Object.keys(picked).length > 0 ? picked : null;
}

function sanitizeEmailDetailsForPlan(details: Record<string, unknown> | null | undefined, plan: string) {
  const visibility = getResultVisibility(plan);
  if (!visibility.includeBasicEmailDetails) return null;

  const pickedKeys: string[] = [...BASIC_EMAIL_DETAIL_KEYS];
  if (visibility.includeStarterEmailDetails) pickedKeys.push(...STARTER_EMAIL_DETAIL_KEYS);
  if (visibility.includeAdvancedEmailDetails) pickedKeys.push(...ADVANCED_EMAIL_DETAIL_KEYS);

  return pickDefinedKeys(details, pickedKeys);
}

function sanitizeIpDetailsForPlan(details: Record<string, unknown> | null | undefined, plan: string) {
  const visibility = getResultVisibility(plan);
  if (!visibility.includeBasicIpDetails) return null;

  const pickedKeys: string[] = [...BASIC_IP_DETAIL_KEYS];
  if (visibility.includeAdvancedIpDetails) pickedKeys.push(...ADVANCED_IP_DETAIL_KEYS);

  return pickDefinedKeys(details, pickedKeys);
}

function readEmailDetail(details: Record<string, unknown> | null | undefined, key: string) {
  return details && details[key] !== undefined ? details[key] : null;
}

export function getPlanRank(plan: string): number {
  return planRank[plan as PlanKey] ?? 0;
}

export function isPlanAtLeast(plan: string, minimumPlan: PlanKey): boolean {
  return getPlanRank(plan) >= planRank[minimumPlan];
}

export function getResultVisibility(plan: string): ResultVisibility {
  return resultVisibilityByPlan[plan as PlanKey] ?? resultVisibilityByPlan.free;
}

export function getResultCacheScope(plan: string): string {
  return getResultVisibility(plan).detailTier;
}

export function shouldUseDeepDetection(plan: string): boolean {
  return isPlanAtLeast(plan, "growth");
}

export function shouldUseAiExplanation(plan: string): boolean {
  return isPlanAtLeast(plan, "scale");
}

export function hasApiAccess(plan: string): boolean {
  return getPlanLimits(plan).apiAccess;
}

export function isContactOnlyPlan(plan: string): boolean {
  return !!(getPlanLimits(plan) as PlanConfig).contactOnly;
}

export function sanitizeSingleRiskPayloadForPlan<T extends Record<string, any>>(payload: T, plan: string): T {
  const visibility = getResultVisibility(plan);
  const emailDetails = sanitizeEmailDetailsForPlan(payload.details?.email ?? null, plan);
  const ipDetails = sanitizeIpDetailsForPlan(payload.details?.ip ?? null, plan);

  return {
    ...payload,
    plan,
    reasons: visibility.includeReasons ? (payload.reasons ?? []) : [],
    impact: visibility.includeImpact ? (payload.impact ?? []) : [],
    solution: visibility.includeSolution ? (payload.solution ?? []) : [],
    domain_age: visibility.includeDomainAge ? (payload.domain_age ?? null) : null,
    dns_health: visibility.includeDnsHealth ? (payload.dns_health ?? null) : null,
    company_health: visibility.includeCompanyHealth ? (payload.company_health ?? null) : null,
    ai_explanation: visibility.includeAiExplanation ? (payload.ai_explanation ?? null) : null,
    risk_factors: visibility.includeRiskFactors ? (payload.risk_factors ?? []) : [],
    recommendation: visibility.includeRecommendation ? (payload.recommendation ?? "") : "",
    estimated_waste_cost: visibility.includeEstimatedWasteCost ? (payload.estimated_waste_cost ?? 0) : null,
    detail_tier: visibility.detailTier,
    details: {
      email: emailDetails,
      ip: ipDetails,
    },
  };
}

export function sanitizeBatchResultForPlan<T extends Record<string, any>>(raw: T, plan: string) {
  const visibility = getResultVisibility(plan);
  const rawEmailDetails = raw.details?.email ?? raw.details ?? null;
  const emailDetails = sanitizeEmailDetailsForPlan(rawEmailDetails, plan);
  const result: Record<string, unknown> = {
    email: raw.email,
    risk_score: raw.risk_score,
    risk_level: raw.risk_level ?? raw.decision,
    decision: raw.risk_level ?? raw.decision,
    cached: !!raw.cached,
    detail_tier: visibility.detailTier,
  };

  if (visibility.includeReasons) result.reasons = raw.reasons ?? [];
  if (visibility.includeRecommendation) result.recommendation = raw.recommendation ?? "";
  if (visibility.includeImpact) result.impact = raw.impact ?? [];
  if (visibility.includeSolution) {
    result.solution = raw.solution ?? [];
    result.solution_summary = Array.isArray(raw.solution)
      ? raw.solution.map((item: Record<string, unknown>) => `${item.category || "Action"}: ${item.fix || ""}`.trim()).join(" | ")
      : "";
  }
  if (visibility.includeRiskFactors) result.risk_factors = raw.risk_factors ?? [];
  if (visibility.includeEstimatedWasteCost) result.estimated_waste_cost = raw.estimated_waste_cost ?? 0;
  if (visibility.includeDomainAge) result.domain_age = raw.domain_age ?? null;
  if (visibility.includeDnsHealth) result.dns_health = raw.dns_health ?? null;
  if (visibility.includeCompanyHealth) {
    result.company_health = raw.company_health ?? null;
    result.health_score = raw.company_health?.healthScore ?? raw.health_score ?? null;
  }
  if (visibility.includeAiExplanation) result.ai_explanation = raw.ai_explanation ?? null;
  if (emailDetails) {
    result.details = emailDetails;
    result.disposable = readEmailDetail(emailDetails, "isDisposable");
    result.role_based = readEmailDetail(emailDetails, "isRoleBased");
    result.catch_all = readEmailDetail(emailDetails, "isCatchAll");
    result.hasMX = readEmailDetail(emailDetails, "hasMX");
    result.mxChecked = readEmailDetail(emailDetails, "mxChecked");
    result.mx_status = readEmailDetail(emailDetails, "mxStatus");
    result.mailbox_status = readEmailDetail(emailDetails, "mailboxStatus");
    result.catch_all_status = readEmailDetail(emailDetails, "catchAllStatus");
    result.decision_explanation = readEmailDetail(emailDetails, "decisionExplanation");

    if (visibility.includeAdvancedEmailDetails) {
      result.inbox_probability = readEmailDetail(emailDetails, "inboxProbability");
      result.estimated_bounce_rate = readEmailDetail(emailDetails, "estimatedBounceRate");
      result.sender_reputation_risk = readEmailDetail(emailDetails, "senderReputationRisk");
    }

    if (visibility.includeAiExplanation) {
      result.dmarc_policy = readEmailDetail(emailDetails, "dmarcPolicy");
      result.dkim_selector = readEmailDetail(emailDetails, "dkimSelector");
      const mxRecords = readEmailDetail(emailDetails, "mxRecords");
      result.mx_records = Array.isArray(mxRecords) ? mxRecords.join(" | ") : "";
    }
  }

  return result;
}

export function getBatchExportColumnsForPlan(plan: string): ExportColumn[] {
  const visibility = getResultVisibility(plan);
  const columns: ExportColumn[] = [
    { key: "email", label: "Email" },
    { key: "decision", label: "Final Decision" },
    { key: "confidence", label: "Decision Confidence" },
    { key: "primary_reason_code", label: "Primary Reason Code" },
    { key: "primary_reason", label: "Primary Reason" },
    { key: "recommended_action", label: "Recommended Action" },
    { key: "decision_explanation", label: "Decision Explanation" },
    { key: "risk_score", label: "Base Signal Score" },
    { key: "risk_level", label: "Final Decision (Legacy Alias)" },
  ];

  if (visibility.includeReasons) {
    columns.push(
      { key: "reasons", label: "Reasons" },
      { key: "recommendation", label: "Recommendation" },
      { key: "disposable", label: "Disposable" },
      { key: "role_based", label: "Role-based" },
      { key: "catch_all", label: "Catch-all" },
      { key: "mx_status", label: "MX Status" },
    );
  }

  if (visibility.includeCompanyHealth) {
    columns.push(
      { key: "health_score", label: "Health Score" },
      { key: "domain_age_days", label: "Domain Age (Days)" },
      { key: "dns_health_score", label: "DNS Health Score" },
      { key: "inbox_probability", label: "Inbox Probability" },
      { key: "estimated_bounce_rate", label: "Estimated Bounce Rate" },
      { key: "sender_reputation_risk", label: "Sender Reputation Risk" },
      { key: "estimated_waste_cost", label: "Estimated Waste Cost" },
      { key: "impact", label: "Impact" },
    );
  }

  if (visibility.includeAiExplanation) {
    columns.push(
      { key: "risk_factors", label: "Risk Factors" },
      { key: "solution_summary", label: "Recommended Actions" },
      { key: "dmarc_policy", label: "DMARC Policy" },
      { key: "dkim_selector", label: "DKIM Selector" },
      { key: "mx_records", label: "MX Records" },
      { key: "ai_explanation", label: "Additional Analysis" },
    );
  }

  return columns;
}
