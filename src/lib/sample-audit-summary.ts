import type { SampleDecision } from "./sample-audit-data";

const sampleAuditCounts: Record<SampleDecision, number> = {
  SEND: 9,
  REVIEW: 6,
  SUPPRESS: 5,
};

export const sampleAuditTotal = Object.values(sampleAuditCounts).reduce((total, count) => total + count, 0);

export const sampleAuditSummary = (["SEND", "REVIEW", "SUPPRESS"] as const).map((decision) => ({
  decision,
  count: sampleAuditCounts[decision],
  percentage: Number(((sampleAuditCounts[decision] / sampleAuditTotal) * 100).toFixed(1)),
}));

export const sampleAuditCampaignDecision: SampleDecision = "REVIEW";

export const sampleAuditReviewDrivers = [
  { label: "Role-based addresses", primaryReason: "Role-based address", count: 2 },
  { label: "Evidence unavailable", primaryReason: "Evidence unavailable", count: 1 },
] as const;

export const sampleAuditRiskDrivers = [
  { label: "Manual review required", riskTag: "manual-review", count: 6 },
  { label: "No usable MX", riskTag: "no-mx", count: 1 },
  { label: "Possible domain typo", riskTag: "domain-typo", count: 2 },
  { label: "Disposable mailbox", riskTag: "disposable", count: 1 },
  { label: "Evidence unavailable", riskTag: "evidence-unavailable", count: 1 },
] as const;
