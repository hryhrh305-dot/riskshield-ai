import { createHash } from "node:crypto";
import { multiplyRatioHalfUp, usd } from "./money";
import type { CommissionDecision, QualifiedSale, RuleVersion } from "./types";

function plusDays(iso: string, days: number) {
  const value = new Date(iso);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString();
}

function stableFingerprint(parts: readonly string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function deterministicUuid(parts:readonly string[]){const hash=stableFingerprint(parts);return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;}

export function calculateCommission(sale: QualifiedSale, version: RuleVersion, shadow = true): CommissionDecision {
  if (sale.programId !== version.programId) throw new Error("AFFILIATE_PROGRAM_RULE_MISMATCH");
  if (sale.selfReferral) throw new Error("AFFILIATE_SELF_REFERRAL");
  if (sale.chargeback || sale.refundedMinor >= sale.gross.amountMinor) throw new Error("AFFILIATE_SALE_NOT_QUALIFIED");
  if (sale.attributionGeneration !== 1) throw new Error("AFFILIATE_MULTI_GENERATION_FORBIDDEN");
  const rule = version.rules.find((item) => item.plan === sale.plan && item.interval === sale.interval);
  if (!rule) throw new Error("AFFILIATE_RULE_NOT_FOUND");
  const decisionId = deterministicUuid([sale.programId, sale.saleId, version.id, sale.affiliateId]);
  const scheduleDays = sale.interval === "annual" ? rule.annualReleaseDays : [rule.reserveDays];
  const weights = scheduleDays.map(() => 1n);
  const denominator = weights.reduce((sum, item) => sum + item, 0n);
  let allocated = 0n;
  const schedule = scheduleDays.map((days, index) => {
    const amount = index === scheduleDays.length - 1
      ? rule.directMinor - allocated
      : multiplyRatioHalfUp(usd(rule.directMinor), weights[index], denominator).amountMinor;
    allocated += amount;
    return Object.freeze({ releaseAt: plusDays(sale.paidAt, days), amount: usd(amount) });
  });
  return Object.freeze({
    decisionId,
    saleId: sale.saleId,
    programId: sale.programId,
    affiliateId: sale.affiliateId,
    ruleVersionId: version.id,
    amount: usd(rule.directMinor),
    status: shadow ? "shadow" : "held",
    reason: shadow ? "SHADOW_MODE" : "RESERVE_PERIOD",
    schedule: Object.freeze(schedule),
    fingerprint: stableFingerprint([decisionId, rule.directMinor.toString(), ...schedule.map((item) => `${item.releaseAt}:${item.amount.amountMinor}`)]),
  });
}

export function calculateClawback(decision: CommissionDecision, refundedMinor: bigint, grossMinor: bigint) {
  if (grossMinor <= 0n || refundedMinor < 0n) throw new Error("AFFILIATE_INVALID_REFUND");
  const capped = refundedMinor > grossMinor ? grossMinor : refundedMinor;
  return multiplyRatioHalfUp(decision.amount, capped, grossMinor);
}

export function assertNoSecondGenerationBenefit(beneficiaryAffiliateId: string, directAffiliateId: string) {
  if (beneficiaryAffiliateId !== directAffiliateId) throw new Error("AFFILIATE_SECOND_GENERATION_FORBIDDEN");
}

export function splitRiskReserve(amountMinor: bigint) {
  const day30 = multiplyRatioHalfUp(usd(amountMinor), 80n, 100n).amountMinor;
  return Object.freeze({ day30: usd(day30), day60: usd(amountMinor - day30) });
}
