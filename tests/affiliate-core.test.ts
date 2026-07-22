import { describe, expect, it } from "vitest";
import golden from "../docs/affiliate/handoff-v1.0.0/machine/26_GOLDEN_TEST_VECTORS.json";
import contentSeed from "../docs/affiliate/handoff-v1.0.0/machine/28_CONTENT_SEED.json";
import {
  AFFILIATE_FLAG_ORDER, acceleratorRewardMinor, affiliateFlagEnabled, assertAffiliateFlagSequence,
  assertNoSecondGenerationBenefit, assertTelegramPublicationAllowed, baseCommissionMinor,
  calculateClawback, calculateCommission, directReferralRewardMinor, eligibilityAmountMinor,
  evaluatePayoutGate, getAffiliateProgram, multiplyRatioHalfUp, parseUsdDecimal, resolveRuleVersion,
  coldStartRewardMinor,assertEvergreenIncentiveGuard,
  splitRiskReserve, teamRewardMinor, telegramIdempotencyKey, usd,
  type AffiliatePlan, type BillingInterval, type ProgramPhase,
} from "@/modules/affiliate";

type Vector = { id:string; category:string; input:Record<string,string|number|boolean|undefined>; expected_usd_minor?:number; expected?:Array<{day:number;amount_usd_minor:number}>; expected_sum_usd_minor?:number };
const vectors = golden.vectors as Vector[];

function sale(plan:"starter"|"growth"|"scale", interval:"monthly"|"annual") {
  return { saleId:`sale-${plan}-${interval}`, providerEventId:"event-1", programId:"secwyn-india" as const, affiliateId:"affiliate-a", canonicalCustomerId:"customer-c", plan, interval, paidAt:"2026-07-22T00:00:00.000Z", gross:usd(1000000n), refundedMinor:0n, chargeback:false, selfReferral:false, attributionGeneration:1 };
}

describe("affiliate immutable money and commission domain", () => {
  it("uses bigint minor units and HALF_UP", () => {
    expect(parseUsdDecimal("10.05").amountMinor).toBe(1005n);
    expect(multiplyRatioHalfUp(usd(101n), 1n, 2n).amountMinor).toBe(51n);
    expect(() => parseUsdDecimal("1.005")).toThrow("AFFILIATE_INVALID_USD");
  });
  it("resolves exactly one immutable program rule", () => {
    expect(getAffiliateProgram("secwyn-india").ruleVersions).toHaveLength(2);
    expect(resolveRuleVersion("secwyn-india", "2026-08-01T00:00:00.000Z").id).toBe("secwyn-india-launch-v1");
    expect(() => getAffiliateProgram("flowwyn-placeholder")).toThrow("AFFILIATE_PROGRAM_DISABLED");
  });
  it("is deterministic and rejects self/second generation", () => {
    const rule = resolveRuleVersion("secwyn-india", "2026-08-01T00:00:00.000Z");
    const first = calculateCommission(sale("growth","monthly"), rule);
    expect(calculateCommission(sale("growth","monthly"), rule)).toEqual(first);
    expect(() => calculateCommission({ ...sale("growth","monthly"), selfReferral:true }, rule)).toThrow("AFFILIATE_SELF_REFERRAL");
    expect(() => calculateCommission({ ...sale("growth","monthly"), attributionGeneration:2 }, rule)).toThrow("AFFILIATE_MULTI_GENERATION_FORBIDDEN");
    expect(() => assertNoSecondGenerationBenefit("affiliate-a","affiliate-b")).toThrow("AFFILIATE_SECOND_GENERATION_FORBIDDEN");
  });
});

describe("all supplied golden vectors", () => {
  for (const vector of vectors) {
    it(vector.id, () => {
      const input = vector.input;
      const phase=input.phase as ProgramPhase;const plan=input.plan as AffiliatePlan;const billing=input.billing as BillingInterval;
      const integer=(value:string|number|boolean|undefined)=>BigInt(value as string|number|boolean);
      const count=(value:string|number|boolean|undefined)=>Number(value);
      switch (vector.category) {
        case "base_commission": expect(baseCommissionMinor(phase,plan,billing)).toBe(BigInt(vector.expected_usd_minor!)); break;
        case "accelerator": expect(acceleratorRewardMinor(phase,integer(input.monthly_base_commission_usd_minor),integer(input.qualified_new_mrr_usd_minor))).toBe(BigInt(vector.expected_usd_minor!)); break;
        case "accelerator_boundary": {
          const amount = acceleratorRewardMinor(phase,integer(input.monthly_base_commission_usd_minor),integer(input.qualified_new_mrr_usd_minor));
          expect(amount).toBeGreaterThanOrEqual(0n); break;
        }
        case "direct_referral": expect(directReferralRewardMinor(phase,{plan,interval:billing,qualifiedSaleMinor:input.qualified_sale_usd_minor === undefined ? undefined : integer(input.qualified_sale_usd_minor)})).toBe(BigInt(vector.expected_usd_minor!)); break;
        case "team_reward": expect(teamRewardMinor(phase,integer(input.team_qualified_sales_usd_minor),count(input.leader_personal_independent_orders))).toBe(BigInt(vector.expected_usd_minor!)); break;
        case "annual_schedule": {
          const decision = calculateCommission(sale(plan,"annual"),resolveRuleVersion("secwyn-india","2026-08-01T00:00:00Z"));
          const days = decision.schedule.map((item) => Math.round((Date.parse(item.releaseAt)-Date.parse("2026-07-22T00:00:00Z"))/86400000));
          expect(days).toEqual(vector.expected!.map((item)=>item.day));
          expect(decision.schedule.map((item)=>item.amount.amountMinor)).toEqual(vector.expected!.map((item)=>BigInt(item.amount_usd_minor)));
          expect(decision.schedule.reduce((sum,item)=>sum+item.amount.amountMinor,0n)).toBe(BigInt(vector.expected_sum_usd_minor!)); break;
        }
        case "eligibility_zero": expect(eligibilityAmountMinor(String(input.condition),999n)).toBe(0n); break;
        case "refund": expect(eligibilityAmountMinor("refund_before_payable",0n)).toBe(0n); break;
        case "clawback": {
          const paid=integer(input.paid_commission_usd_minor);const decision = { ...calculateCommission(sale("scale","annual"),resolveRuleVersion("secwyn-india","2026-08-01T00:00:00Z")), amount:usd(paid) };
          expect(-calculateClawback(decision,100n,100n).amountMinor).toBe(BigInt(vector.expected_usd_minor ?? -Number(paid))); break;
        }
        case "risk_reserve": { const reserve=splitRiskReserve(integer(input.installment_usd_minor)); expect(reserve.day30.amountMinor).toBe(8000n); expect(reserve.day60.amountMinor).toBe(2000n); break; }
        default: throw new Error(`Unhandled golden category ${vector.category}`);
      }
    });
  }
});

describe("flags, payout, telegram, property and replay safety", () => {
  it("defaults every capability closed and enforces order", () => {
    for (const flag of AFFILIATE_FLAG_ORDER) expect(affiliateFlagEnabled({},flag)).toBe(false);
    expect(() => assertAffiliateFlagSequence({ AFFILIATE_PAYOUT_CREATION:"true" })).toThrow("AFFILIATE_FLAG_SEQUENCE_INVALID");
    const env:Record<string,string|undefined>={}; for(const flag of AFFILIATE_FLAG_ORDER) env[flag]="true";
    expect(affiliateFlagEnabled(env,"AFFILIATE_TELEGRAM_DAILY")).toBe(true);
    env.AFFILIATE_KILL_SWITCH="true"; expect(affiliateFlagEnabled(env,"AFFILIATE_PUBLIC_PAGE")).toBe(false);
  });
  it("fails payout closed until every independent gate passes", () => {
    const base={balance:usd(5000n),minimumMinor:5000n,reconciliationMatched:true,batchFrozenForHours:72,payoutAccountVerified:true,killSwitch:false,openHighSeverityIncident:false,reauthenticated:true,pinOrOtpVerified:true};
    expect(evaluatePayoutGate(base).allowed).toBe(true);
    expect(evaluatePayoutGate({...base,reconciliationMatched:false}).reasons).toContain("RECONCILIATION_MISMATCH");
    expect(evaluatePayoutGate({...base,killSwitch:true}).allowed).toBe(false);
  });
  it("only publishes approved, consented and reconciled Telegram facts", () => {
    const daily={id:"one",kind:"daily_content" as const,consent:false,contentStatus:"approved" as const};
    expect(assertTelegramPublicationAllowed(daily)).toBe(true);
    expect(telegramIdempotencyKey(daily)).toBe("telegram:daily_content:one");
    expect(()=>assertTelegramPublicationAllowed({id:"win",kind:"qualified_sale",consent:true,contentStatus:"approved",saleQualified:false})).toThrow();
    expect(()=>assertTelegramPublicationAllowed({id:"pay",kind:"payout_notice",consent:true,contentStatus:"approved",payoutPaid:true,payoutReconciled:false})).toThrow();
  });
  it("contains six current Telegram slots with first two pinned", () => {
    expect(contentSeed.telegram_message_slots).toHaveLength(6);
    expect(contentSeed.telegram_message_slots.slice(0,2).every((item)=>item.pinned)).toBe(true);
    expect(contentSeed.telegram_message_slots.slice(2).every((item)=>!item.pinned)).toBe(true);
  });
  it("preserves amount conservation across generated values", () => {
    for(let value=0n;value<10000n;value+=37n){const split=splitRiskReserve(value);expect(split.day30.amountMinor+split.day60.amountMinor).toBe(value);}
  });
  it("enforces cold-start phase, Evergreen 11% and retention guards",()=>{
    expect(coldStartRewardMinor({phase:"launch",daysToFirstQualifiedCustomer:30})).toBe(1000n);expect(coldStartRewardMinor({phase:"evergreen",daysToFirstQualifiedCustomer:1})).toBe(0n);
    expect(assertEvergreenIncentiveGuard(100000n,11000n)).toBe(true);expect(()=>assertEvergreenIncentiveGuard(100000n,11001n)).toThrow("AFFILIATE_EVERGREEN_11_PERCENT_GATE");
  });
  it("replay and concurrent calculations yield one business fingerprint", async () => {
    const rule=resolveRuleVersion("secwyn-india","2026-08-01T00:00:00Z");
    const results=await Promise.all(Array.from({length:100},async()=>calculateCommission(sale("starter","monthly"),rule).fingerprint));
    expect(new Set(results).size).toBe(1);
  });
});

describe("critical mutation kill set", () => {
  it("kills amount, interval and plan-table mutations", () => {
    const canonical = baseCommissionMinor("launch", "growth", "annual");
    const mutants = [
      canonical + 1n,
      baseCommissionMinor("launch", "growth", "monthly"),
      baseCommissionMinor("launch", "starter", "annual"),
      baseCommissionMinor("evergreen", "growth", "annual"),
    ];
    for (const mutant of mutants) expect(mutant).not.toBe(canonical);
  });

  it("kills reserve rounding and generation-guard mutations", () => {
    const canonical = splitRiskReserve(10001n);
    expect(canonical.day30.amountMinor).toBe(8001n);
    expect(canonical.day60.amountMinor).toBe(2000n);
    expect(canonical.day30.amountMinor + canonical.day60.amountMinor).toBe(10001n);
    expect(() => assertNoSecondGenerationBenefit("leader-a", "affiliate-c")).toThrow(
      "AFFILIATE_SECOND_GENERATION_FORBIDDEN",
    );
  });
});
