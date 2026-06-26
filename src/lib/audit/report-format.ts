import type { ListAuditSummary } from "@/lib/list-audit";

export type AuditReportFormat = {
  launchStatusLabel: string;
  listAcceptanceLabel: string;
  sendLabel: string;
  reviewLabel: string;
  suppressLabel: string;
  readinessLabel: string;
  generatedAtLabel: string;
  summaryLine: string;
  topRiskReasonText: string;
  wasteSnapshot: string;
};

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatLaunchStatus(value: string): string {
  if (value === "ready_to_launch") return "Ready to Launch";
  if (value === "launch_with_caution") return "Launch with Caution";
  return "Do Not Launch";
}

function formatListAcceptance(value: string): string {
  if (value === "accept_as_is") return "Accept as Is";
  if (value === "accept_after_cleanup") return "Accept After Cleanup";
  if (value === "needs_enrichment") return "Needs Enrichment";
  return "Reject / Do Not Send";
}

export function formatAuditReport(summary: ListAuditSummary, generatedAt = new Date()): AuditReportFormat {
  const topRiskReason = summary.topRiskReasons[0];
  const waste = summary.estimatedWastePrevented;

  return {
    launchStatusLabel: formatLaunchStatus(summary.launchStatus),
    listAcceptanceLabel: formatListAcceptance(summary.listAcceptance),
    sendLabel: `${formatNumber(summary.sendCount)} (${formatPercent(summary.sendRate)})`,
    reviewLabel: `${formatNumber(summary.reviewCount)} (${formatPercent(summary.reviewRate)})`,
    suppressLabel: `${formatNumber(summary.suppressCount)} (${formatPercent(summary.suppressRate)})`,
    readinessLabel: `${summary.campaignReadinessScore}/100`,
    generatedAtLabel: generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    summaryLine: `This list is currently marked as ${formatLaunchStatus(summary.launchStatus).toLowerCase()} and should be handled as a ${formatListAcceptance(summary.listAcceptance).toLowerCase()} workflow.`,
    topRiskReasonText: topRiskReason ? `${topRiskReason.label} (${topRiskReason.count})` : "No dominant risk reason detected.",
    wasteSnapshot: `${formatNumber(waste.riskySendsPrevented)} risky sends prevented · ${formatNumber(waste.estimatedSendingCreditsSaved)} credits saved · ${waste.estimatedSdrTimeSavedHours.toFixed(2)} SDR hours saved · ${formatCurrency(waste.estimatedWasteSavedUsd)} waste prevented`,
  };
}
