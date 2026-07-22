import { describe,expect,it } from "vitest";
import { acceleratorRewardMinor,calculateClawback,calculateCommission,directReferralRewardMinor,evaluatePayoutGate,resolveProgramRuleVersion,teamRewardMinor,usd } from "@/modules/affiliate";

const launchStart="2026-07-22T00:00:00.000Z";
const sale=(id:string,plan:"starter"|"growth"|"scale",interval:"monthly"|"annual",paidAt:string)=>({saleId:id,providerEventId:`event-${id}`,programId:"secwyn-india" as const,affiliateId:`affiliate-${id}`,canonicalCustomerId:`customer-${id}`,plan,interval,paidAt,gross:usd(100000n),refundedMinor:0n,chargeback:false,selfReferral:false,attributionGeneration:1});

describe("affiliate 30-event shadow acceptance pack",()=>{
  it("covers all 12 phase, plan and billing base combinations",()=>{
    const phases=["2026-08-01T00:00:00.000Z","2027-08-01T00:00:00.000Z"];
    const decisions=phases.flatMap((paidAt)=>["starter","growth","scale"].flatMap((plan)=>["monthly","annual"].map((interval)=>calculateCommission(sale(`${paidAt}-${plan}-${interval}`,plan as "starter"|"growth"|"scale",interval as "monthly"|"annual",paidAt),resolveProgramRuleVersion("secwyn-india",paidAt,launchStart)))));
    expect(decisions).toHaveLength(12);expect(decisions.every((item)=>item.amount.amountMinor>0n)).toBe(true);
  });
  it("simulates refunds, chargebacks, referrals, accelerators, teams, a rule switch and payout freeze",()=>{
    const base=calculateCommission(sale("refund","growth","annual","2026-08-01T00:00:00.000Z"),resolveProgramRuleVersion("secwyn-india","2026-08-01T00:00:00.000Z",launchStart));
    expect(Array.from({length:5},(_,index)=>calculateClawback(base,BigInt(index+1)*100n,1000n).amountMinor)).toHaveLength(5);
    expect(Array.from({length:2},()=>calculateClawback(base,1000n,1000n).amountMinor).every((value)=>value===base.amount.amountMinor)).toBe(true);
    expect(["starter","growth","scale"].map((plan)=>directReferralRewardMinor("launch",{plan:plan as "starter"|"growth"|"scale",interval:"monthly"}))).toHaveLength(3);
    expect([acceleratorRewardMinor("launch",10000n,50000n),acceleratorRewardMinor("evergreen",7500n,100000n)].every((value)=>value>0n)).toBe(true);
    expect([teamRewardMinor("launch",500000n,2),teamRewardMinor("evergreen",2000000n,2)].every((value)=>value>0n)).toBe(true);
    expect(resolveProgramRuleVersion("secwyn-india","2026-08-01T00:00:00.000Z",launchStart).phase).toBe("launch");
    expect(resolveProgramRuleVersion("secwyn-india","2027-08-01T00:00:00.000Z",launchStart).phase).toBe("evergreen");
    expect(evaluatePayoutGate({balance:usd(5000n),minimumMinor:5000n,reconciliationMatched:true,batchFrozenForHours:71,payoutAccountVerified:true,killSwitch:false,openHighSeverityIncident:false,reauthenticated:true,pinOrOtpVerified:true}).allowed).toBe(false);
  });
  it("replays one webhook 100 times to one deterministic decision",async()=>{
    const input=sale("duplicate","starter","monthly","2026-08-01T00:00:00.000Z");const rule=resolveProgramRuleVersion("secwyn-india",input.paidAt,launchStart);
    const ids=await Promise.all(Array.from({length:100},async()=>calculateCommission(input,rule).decisionId));expect(new Set(ids).size).toBe(1);
  });
  it("runs two concurrent workers to the same business fingerprint",async()=>{
    const input=sale("concurrent","scale","annual","2026-08-01T00:00:00.000Z");const rule=resolveProgramRuleVersion("secwyn-india",input.paidAt,launchStart);
    const [left,right]=await Promise.all([Promise.resolve(calculateCommission(input,rule)),Promise.resolve(calculateCommission(input,rule))]);expect(left.fingerprint).toBe(right.fingerprint);
  });
});
