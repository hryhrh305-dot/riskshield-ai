import { createHash } from "node:crypto";
import { getMonthlyCycle } from "./credit-cycle";
import { getCreditsForPlan } from "./creem";
import type { CreditAccountingClient } from "./credit-accounting";

export async function grantSubscriptionCycle({ supabase,userId,subscriptionId,plan,anchor,at,paidThrough }:{
  supabase:CreditAccountingClient;userId:string;subscriptionId:string;plan:string;anchor:string;at:string;paidThrough:string;
}) {
  const amount=getCreditsForPlan(plan);
  if (!amount || plan==="business") throw new Error("SUBSCRIPTION_CREDIT_AMOUNT_REQUIRED");
  if (!paidThrough) throw new Error("SUBSCRIPTION_PAID_PERIOD_REQUIRED");
  const cycle=getMonthlyCycle(anchor,new Date(at));
  const fingerprint=createHash("sha256").update(JSON.stringify({userId,subscriptionId,plan,amount,cycle})).digest("hex");
  const {data,error}=await supabase.rpc("grant_subscription_cycle_credits",{
    p_user_id:userId,p_subscription_ref:subscriptionId,p_plan:plan,p_amount:amount,
    p_starts_at:cycle.start,p_expires_at:cycle.end,p_fingerprint:fingerprint,p_anchor:anchor,p_paid_through:paidThrough,
  });
  if(error) throw new Error(error.message||"SUBSCRIPTION_CREDIT_GRANT_FAILED");
  return Array.isArray(data)?data[0]:data;
}

export async function revokeSubscriptionCredits({supabase,userId,subscriptionId,reason,terminalStatus}:{
  supabase:CreditAccountingClient;userId:string;subscriptionId:string;reason:string;terminalStatus:"cancelled"|"paused";
}) {
  const {data,error}=await supabase.rpc("revoke_subscription_credits",{
    p_user_id:userId,p_subscription_ref:subscriptionId,p_reason:reason,p_terminal_status:terminalStatus,
  });
  if(error) throw new Error(error.message||"SUBSCRIPTION_CREDIT_REVOKE_FAILED");
  return data;
}

export async function grantFreeCycle({supabase,userId,anchor,at}:{
  supabase:CreditAccountingClient;userId:string;anchor:string;at:string;
}) {
  const cycle=getMonthlyCycle(anchor,new Date(at));
  const fingerprint=createHash("sha256").update(JSON.stringify({userId,anchor,cycle,amount:50})).digest("hex");
  const {data,error}=await supabase.rpc("grant_free_cycle_credits",{
    p_user_id:userId,p_anchor:anchor,p_starts_at:cycle.start,p_expires_at:cycle.end,p_fingerprint:fingerprint,
  });
  if(error) throw new Error(error.message||"FREE_CREDIT_GRANT_FAILED");
  return Array.isArray(data)?data[0]:data;
}
