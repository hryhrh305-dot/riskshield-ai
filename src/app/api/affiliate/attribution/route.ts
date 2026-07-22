import { NextRequest,NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { affiliateFlagEnabled } from "@/modules/affiliate";
import { canonicalAffiliateCustomerId,verifyAffiliateClick } from "@/modules/affiliate/application/attribution";
import { requireAffiliateUser } from "@/modules/affiliate/application/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request:NextRequest){
  if(!affiliateFlagEnabled(process.env,"AFFILIATE_ATTRIBUTION")) return NextResponse.json({error:"Not found."},{status:404});
  try{
    const user=await requireAffiliateUser(); const token=request.cookies.get("secwyn_affiliate_click")?.value; if(!token) return NextResponse.json({ok:false,reason:"no_click"});
    const click=verifyAffiliateClick(token); const admin=getSupabaseAdminClient();
    const {data:affiliate}=await admin.from("affiliate_memberships").select("id,user_id,status").eq("program_id","secwyn-india").eq("affiliate_code",click.code).in("status",["provisional","approved"]).single();
    if(!affiliate||affiliate.user_id===user.id) return NextResponse.json({ok:false,reason:"ineligible"},{status:409});
    const canonicalCustomerId=canonicalAffiliateCustomerId(user.id); const fingerprint=createHash("sha256").update(`secwyn-india|${affiliate.id}|${canonicalCustomerId}`).digest("hex");
    const {error}=await admin.rpc("affiliate_lock_attribution",{p_customer_user_id:user.id,p_affiliate_id:affiliate.id,p_canonical_customer_id:canonicalCustomerId,p_click_at:click.clickedAt,p_source:click.source||null,p_channel_code:click.channelCode||null,p_fingerprint:fingerprint,p_correlation_id:crypto.randomUUID()});
    if(error&&error.code!=="23505") throw error;
    const response=NextResponse.json({ok:true}); response.cookies.delete("secwyn_affiliate_click"); return response;
  }catch{return NextResponse.json({error:"Attribution failed closed."},{status:400});}
}
