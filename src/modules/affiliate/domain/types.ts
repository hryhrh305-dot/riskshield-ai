export type AffiliateProgramId = "secwyn-india" | "flowwyn-placeholder";
export type AffiliateCurrency = "USD";
export type Money = Readonly<{ amountMinor: bigint; currency: AffiliateCurrency }>;
export type BillingInterval = "monthly" | "annual";
export type AffiliatePlan = "starter" | "growth" | "scale";
export type CommissionDecisionStatus = "shadow" | "held" | "payable" | "reversed";

export type CommissionRule = Readonly<{
  plan: AffiliatePlan;
  interval: BillingInterval;
  directMinor: bigint;
  reserveDays: 30 | 60;
  annualReleaseDays: readonly number[];
}>;

export type RuleVersion = Readonly<{
  id: string;
  programId: AffiliateProgramId;
  version: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: "draft" | "approved" | "published" | "retired";
  phase: "launch" | "evergreen";
  rules: readonly CommissionRule[];
}>;

export type QualifiedSale = Readonly<{
  saleId: string;
  providerEventId: string;
  programId: AffiliateProgramId;
  affiliateId: string;
  canonicalCustomerId: string;
  plan: AffiliatePlan;
  interval: BillingInterval;
  paidAt: string;
  gross: Money;
  refundedMinor: bigint;
  chargeback: boolean;
  selfReferral: boolean;
  attributionGeneration: number;
}>;

export type CommissionDecision = Readonly<{
  decisionId: string;
  saleId: string;
  programId: AffiliateProgramId;
  affiliateId: string;
  ruleVersionId: string;
  amount: Money;
  status: CommissionDecisionStatus;
  reason: string;
  schedule: readonly Readonly<{ releaseAt: string; amount: Money }>[];
  fingerprint: string;
}>;
