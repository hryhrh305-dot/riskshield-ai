import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { grantFreeCycle, grantSubscriptionCycle } from "@/lib/subscription-credits";

export async function reconcileDueCreditCycles({now=new Date(),limit=500}:{now?:Date;limit?:number}={}) {
  const supabase=getSupabaseAdminClient();
  const nowIso=now.toISOString();
  const safeLimit=Math.min(500,Math.max(1,Math.trunc(limit)));
  const perTypeLimit=Math.max(1,Math.floor(safeLimit/2));
  const [{data:subscriptions,error:subscriptionError},{data:freeProfiles,error:freeError}]=await Promise.all([
    supabase.from("subscriptions").select("user_id,provider_subscription_id,plan,credit_anchor_at,paid_through,billing_interval,cancel_at_period_end")
      .eq("status","active").in("plan",["starter","growth","scale"])
      .not("credit_anchor_at","is",null).gt("paid_through",nowIso)
      .order("updated_at",{ascending:true}).order("provider_subscription_id",{ascending:true}).limit(perTypeLimit),
    supabase.from("profiles").select("id,created_at").eq("plan","free")
      .order("updated_at",{ascending:true}).order("id",{ascending:true}).limit(perTypeLimit),
  ]);
  if(subscriptionError) throw subscriptionError;
  if(freeError) throw freeError;
  const jobs:Array<()=>Promise<unknown>>=[];
  for(const row of subscriptions||[]) {
    if(!row.provider_subscription_id||!row.credit_anchor_at||!row.paid_through) continue;
    jobs.push(async()=>{
      const {data:payment,error:paymentError}=await supabase.from("payments").select("provider_transaction_id")
        .eq("user_id",row.user_id).eq("provider","creem")
        .eq("provider_subscription_id",row.provider_subscription_id).eq("status","completed")
        .not("provider_transaction_id","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(paymentError) throw paymentError;
      if(!payment?.provider_transaction_id) throw new Error("SUBSCRIPTION_PAYMENT_TRANSACTION_REQUIRED");
      return grantSubscriptionCycle({supabase,userId:row.user_id,subscriptionId:row.provider_subscription_id,
        plan:row.plan,anchor:row.credit_anchor_at,at:nowIso,paidThrough:row.paid_through,
        providerTransactionId:payment.provider_transaction_id});
    });
  }
  for(const row of freeProfiles||[]) {
    if(row.created_at) jobs.push(()=>grantFreeCycle({supabase,userId:row.id,anchor:row.created_at,at:nowIso}));
  }
  let processed=0;
  let failed=0;
  for(let offset=0;offset<jobs.length;offset+=10) {
    const results=await Promise.allSettled(jobs.slice(offset,offset+10).map(job=>job()));
    processed+=results.filter((result)=>result.status==="fulfilled").length;
    failed+=results.filter((result)=>result.status==="rejected").length;
  }
  if(failed) throw new Error(`CREDIT_RECONCILIATION_PARTIAL_FAILURE:${processed}:${failed}`);
  return {processed,paidCandidates:subscriptions?.length||0,freeCandidates:freeProfiles?.length||0,at:nowIso};
}
