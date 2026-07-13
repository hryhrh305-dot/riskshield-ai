export type CreditType = "contact_audit" | "client_report";

export type CreditSourceType =
  | "subscription"
  | "top_up"
  | "referral_bonus"
  | "small_report"
  | "manual_adjustment";

export type CreditGrantStatus =
  | "active"
  | "expired"
  | "consumed"
  | "revoked";

export type CreditUsageReason =
  | "audit_contacts"
  | "export_client_report"
  | "api_audit"
  | "sheets_audit"
  | "small_report_audit"
  | "refund_reversal"
  | "manual_adjustment";

export type CreditGrant = {
  id: string;
  userId: string;
  workspaceId?: string | null;
  creditType: CreditType;
  sourceType: CreditSourceType;
  sourceRef?: string | null;
  grantedAmount: number;
  remainingAmount: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  status: CreditGrantStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreditUsageAllocation = {
  creditGrantId: string;
  creditType: CreditType;
  amountUsed: number;
  usageReason: CreditUsageReason;
  remainingAfterUse: number;
};

export type CreditSummary = {
  contacts: {
    subscriptionRemaining: number;
    topUpRemaining: number;
    referralRemaining: number;
    smallReportRemaining: number;
    manualAdjustmentRemaining: number;
    totalUsable: number;
    nearestExpiration: string | null;
  };
  reports: {
    subscriptionRemaining: number;
    extraReportRemaining: number;
    referralRemaining: number;
    manualAdjustmentRemaining: number;
    totalUsable: number;
    nearestExpiration: string | null;
  };
};

function clampAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function toDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoOrNull(value?: string | null): string | null {
  const parsed = toDateOrNull(value);
  return parsed ? parsed.toISOString() : null;
}

function getGrantExpirationMs(grant: CreditGrant): number | null {
  const parsed = toDateOrNull(grant.expiresAt);
  return parsed ? parsed.getTime() : null;
}

function getGrantCreatedMs(grant: CreditGrant): number {
  const parsed = toDateOrNull(grant.createdAt);
  return parsed ? parsed.getTime() : 0;
}

function getNearestExpiration(current: number | null, candidate: number | null): number | null {
  if (candidate == null) return current;
  if (current == null) return candidate;
  return Math.min(current, candidate);
}

function isMatchingCreditBucket(grant: CreditGrant, creditType: CreditType): boolean {
  return grant.creditType === creditType;
}

function getUsageMessage(creditType: CreditType): string {
  return creditType === "contact_audit"
    ? "Not enough audit capacity. Add top-up credits or upgrade your plan."
    : "No client-ready report credits remaining. Add extra report credits or upgrade your plan.";
}

function getSourceBucketKey(
  grant: CreditGrant,
): "subscription" | "topUp" | "referral" | "smallReport" | "manualAdjustment" {
  if (grant.sourceType === "top_up") return "topUp";
  if (grant.sourceType === "referral_bonus") return "referral";
  if (grant.sourceType === "small_report") return "smallReport";
  if (grant.sourceType === "manual_adjustment") return "manualAdjustment";
  return "subscription";
}

function accumulateSummaryBucket(
  summary: CreditSummary,
  grant: CreditGrant,
): void {
  const bucket = getSourceBucketKey(grant);
  const amount = grant.remainingAmount;

  if (grant.creditType === "contact_audit") {
    if (bucket === "subscription") summary.contacts.subscriptionRemaining += amount;
    if (bucket === "topUp") summary.contacts.topUpRemaining += amount;
    if (bucket === "referral") summary.contacts.referralRemaining += amount;
    if (bucket === "smallReport") summary.contacts.smallReportRemaining += amount;
    if (bucket === "manualAdjustment") summary.contacts.manualAdjustmentRemaining += amount;
    summary.contacts.totalUsable += amount;
    summary.contacts.nearestExpiration = nearestExpirationIso(summary.contacts.nearestExpiration, grant.expiresAt);
    return;
  }

  if (bucket === "subscription") summary.reports.subscriptionRemaining += amount;
  if (bucket === "topUp") summary.reports.extraReportRemaining += amount;
  if (bucket === "referral") summary.reports.referralRemaining += amount;
  if (bucket === "manualAdjustment") summary.reports.manualAdjustmentRemaining += amount;
  summary.reports.totalUsable += amount;
  summary.reports.nearestExpiration = nearestExpirationIso(summary.reports.nearestExpiration, grant.expiresAt);
}

function nearestExpirationIso(current: string | null, next: string | null | undefined): string | null {
  const currentDate = toDateOrNull(current);
  const nextDate = toDateOrNull(next ?? null);
  if (!nextDate) return current;
  if (!currentDate) return nextDate.toISOString();
  return nextDate.getTime() < currentDate.getTime() ? nextDate.toISOString() : current;
}

export function normalizeCreditGrant(grant: CreditGrant): CreditGrant {
  return {
    ...grant,
    grantedAmount: clampAmount(grant.grantedAmount),
    remainingAmount: clampAmount(grant.remainingAmount),
    startsAt: toIsoOrNull(grant.startsAt ?? null),
    expiresAt: toIsoOrNull(grant.expiresAt ?? null),
    billingPeriodStart: toIsoOrNull(grant.billingPeriodStart ?? null),
    billingPeriodEnd: toIsoOrNull(grant.billingPeriodEnd ?? null),
    createdAt: toIsoOrNull(grant.createdAt ?? null),
    updatedAt: toIsoOrNull(grant.updatedAt ?? null),
  };
}

export function isCreditGrantUsable(grant: CreditGrant, now: Date = new Date()): boolean {
  const normalized = normalizeCreditGrant(grant);
  const startDate = toDateOrNull(normalized.startsAt ?? null);
  const expiresDate = toDateOrNull(normalized.expiresAt ?? null);

  if (normalized.status !== "active") return false;
  if (normalized.grantedAmount <= 0 || normalized.remainingAmount <= 0) return false;
  if (startDate && startDate.getTime() > now.getTime()) return false;
  if (expiresDate && expiresDate.getTime() <= now.getTime()) return false;
  return true;
}

export function sortCreditGrantsForConsumption(grants: CreditGrant[], now: Date = new Date()): CreditGrant[] {
  return grants
    .map(normalizeCreditGrant)
    .filter((grant) => isCreditGrantUsable(grant, now))
    .sort((a, b) => {
      const aPriority = a.sourceType === "referral_bonus" ? 0 : a.sourceType === "subscription" ? 1 : 2;
      const bPriority = b.sourceType === "referral_bonus" ? 0 : b.sourceType === "subscription" ? 1 : 2;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aExpires = getGrantExpirationMs(a);
      const bExpires = getGrantExpirationMs(b);
      const aHasExpires = aExpires != null;
      const bHasExpires = bExpires != null;

      if (aHasExpires !== bHasExpires) return aHasExpires ? -1 : 1;
      if (aExpires !== bExpires) return (aExpires ?? Number.POSITIVE_INFINITY) - (bExpires ?? Number.POSITIVE_INFINITY);

      const aCreated = getGrantCreatedMs(a);
      const bCreated = getGrantCreatedMs(b);
      if (aCreated !== bCreated) return aCreated - bCreated;

      return a.id.localeCompare(b.id);
    });
}

export function calculateCreditSummary(grants: CreditGrant[], now: Date = new Date()): CreditSummary {
  const summary: CreditSummary = {
    contacts: {
      subscriptionRemaining: 0,
      topUpRemaining: 0,
      referralRemaining: 0,
      smallReportRemaining: 0,
      manualAdjustmentRemaining: 0,
      totalUsable: 0,
      nearestExpiration: null,
    },
    reports: {
      subscriptionRemaining: 0,
      extraReportRemaining: 0,
      referralRemaining: 0,
      manualAdjustmentRemaining: 0,
      totalUsable: 0,
      nearestExpiration: null,
    },
  };

  for (const grant of grants) {
    const normalized = normalizeCreditGrant(grant);
    if (!isCreditGrantUsable(normalized, now)) continue;
    accumulateSummaryBucket(summary, normalized);
  }

  return summary;
}

export function planCreditConsumption(params: {
  grants: CreditGrant[];
  creditType: CreditType;
  amount: number;
  usageReason: CreditUsageReason;
  now?: Date;
}):
  | { ok: true; allocations: CreditUsageAllocation[]; totalUsed: number }
  | { ok: false; error: string; requiredAmount: number; availableAmount: number } {
  const amount = clampAmount(params.amount);
  if (amount <= 0) {
    return {
      ok: false,
      error: "Requested credit amount must be greater than zero.",
      requiredAmount: amount,
      availableAmount: 0,
    };
  }

  const now = params.now ?? new Date();
  const sorted = sortCreditGrantsForConsumption(params.grants, now).filter((grant) => isMatchingCreditBucket(grant, params.creditType));
  const availableAmount = sorted.reduce((sum, grant) => sum + grant.remainingAmount, 0);

  if (availableAmount < amount) {
    return {
      ok: false,
      error: getUsageMessage(params.creditType),
      requiredAmount: amount,
      availableAmount,
    };
  }

  let remaining = amount;
  const allocations: CreditUsageAllocation[] = [];

  for (const grant of sorted) {
    if (remaining <= 0) break;
    const used = Math.min(grant.remainingAmount, remaining);
    const remainingAfterUse = grant.remainingAmount - used;
    allocations.push({
      creditGrantId: grant.id,
      creditType: grant.creditType,
      amountUsed: used,
      usageReason: params.usageReason,
      remainingAfterUse,
    });
    remaining -= used;
  }

  return {
    ok: true,
    allocations,
    totalUsed: amount,
  };
}

export function getInsufficientCreditsMessage(creditType: CreditType): string {
  return getUsageMessage(creditType);
}

export function markExpiredCreditGrants(grants: CreditGrant[], now: Date = new Date()): CreditGrant[] {
  return grants.map((grant) => {
    const normalized = normalizeCreditGrant(grant);
    const expiresDate = toDateOrNull(normalized.expiresAt ?? null);

    if (normalized.status === "active" && expiresDate && expiresDate.getTime() <= now.getTime()) {
      return {
        ...normalized,
        status: "expired",
      };
    }

    return normalized;
  });
}
