import { multiplyRatioHalfUp, usd } from "./money";
import type { AffiliatePlan, BillingInterval } from "./types";

export type ProgramPhase = "launch" | "evergreen";

const BASE: Record<ProgramPhase, Record<AffiliatePlan, Record<BillingInterval, bigint>>> = {
  launch: { starter: { monthly: 2500n, annual: 12000n }, growth: { monthly: 10000n, annual: 60000n }, scale: { monthly: 30000n, annual: 150000n } },
  evergreen: { starter: { monthly: 1500n, annual: 10000n }, growth: { monthly: 7500n, annual: 50000n }, scale: { monthly: 25000n, annual: 120000n } },
};
const ACCELERATOR: Record<ProgramPhase, readonly [bigint,bigint][]> = {
  launch: [[50000n,500n],[150000n,1000n],[500000n,1500n]],
  evergreen: [[100000n,300n],[300000n,600n],[1000000n,1000n]],
};
const LAUNCH_DIRECT: Record<AffiliatePlan, Record<BillingInterval,bigint>> = {
  starter: { monthly: 500n, annual: 1500n }, growth: { monthly: 2000n, annual: 5000n }, scale: { monthly: 7500n, annual: 15000n },
};
const TEAM: Record<ProgramPhase, readonly [bigint,bigint][]> = {
  launch: [[500000n,5000n],[1500000n,20000n],[4000000n,60000n],[10000000n,150000n],[25000000n,375000n],[60000000n,900000n]],
  evergreen: [[500000n,5000n],[2000000n,20000n],[5000000n,50000n],[15000000n,150000n],[40000000n,400000n],[100000000n,1000000n]],
};

export const baseCommissionMinor = (phase: ProgramPhase, plan: AffiliatePlan, interval: BillingInterval) => BASE[phase][plan][interval];

export function acceleratorRewardMinor(phase: ProgramPhase, monthlyBaseMinor: bigint, qualifiedNewMrrMinor: bigint) {
  const tier = [...ACCELERATOR[phase]].reverse().find(([threshold]) => qualifiedNewMrrMinor >= threshold);
  return tier ? multiplyRatioHalfUp(usd(monthlyBaseMinor), tier[1], 10000n).amountMinor : 0n;
}

export function directReferralRewardMinor(phase: ProgramPhase, input: { plan?: AffiliatePlan; interval?: BillingInterval; qualifiedSaleMinor?: bigint }) {
  if (phase === "launch") {
    if (!input.plan || !input.interval) throw new Error("AFFILIATE_REFERRAL_INPUT_REQUIRED");
    return LAUNCH_DIRECT[input.plan][input.interval];
  }
  if (input.qualifiedSaleMinor === undefined) throw new Error("AFFILIATE_REFERRAL_INPUT_REQUIRED");
  const calculated = multiplyRatioHalfUp(usd(input.qualifiedSaleMinor), 50n, 10000n).amountMinor;
  return calculated > 7500n ? 7500n : calculated;
}

export function teamRewardMinor(phase: ProgramPhase, teamSalesMinor: bigint, leaderPersonalIndependentOrders: number) {
  if (leaderPersonalIndependentOrders < 2) return 0n;
  return [...TEAM[phase]].reverse().find(([threshold]) => teamSalesMinor >= threshold)?.[1] || 0n;
}

export function eligibilityAmountMinor(condition: string, proposedMinor: bigint) {
  const blocked = new Set(["duplicate_event","test_environment","payment_not_succeeded","not_first_qualified_payment","strong_block_signal","relationship_depth_gt_1","membership_ineligible"]);
  return blocked.has(condition) ? 0n : proposedMinor;
}

export function coldStartRewardMinor(input:{phase:ProgramPhase;daysToFirstQualifiedCustomer?:number;directAffiliatesWithFirstSale?:number;leaderPersonalIndependentOrders?:number}){
  if(input.phase!=="launch") return 0n;if(input.daysToFirstQualifiedCustomer!==undefined&&input.daysToFirstQualifiedCustomer<=30) return 1000n;
  if((input.directAffiliatesWithFirstSale||0)>=3&&(input.leaderPersonalIndependentOrders||0)>=2) return 3000n;return 0n;
}

export function assertEvergreenIncentiveGuard(revenueMinor:bigint,totalIncentiveMinor:bigint){
  if(revenueMinor<=0n||totalIncentiveMinor<0n) throw new Error("AFFILIATE_INCENTIVE_GUARD_INPUT_INVALID");
  if(totalIncentiveMinor*10000n>revenueMinor*1100n) throw new Error("AFFILIATE_EVERGREEN_11_PERCENT_GATE");
  if((revenueMinor-totalIncentiveMinor)*10000n<revenueMinor*8000n) throw new Error("AFFILIATE_RETENTION_GUARD");return true;
}
