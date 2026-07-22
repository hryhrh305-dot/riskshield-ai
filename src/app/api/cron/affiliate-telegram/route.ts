import { NextResponse } from "next/server";
import { affiliateFlagEnabled, affiliateOperationalFlagEnabled, dispatchTelegram, TelegramBotAdapter, type TelegramPublication } from "@/modules/affiliate";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request){
  if(!affiliateFlagEnabled(process.env,"AFFILIATE_TELEGRAM_DAILY")) return NextResponse.json({error:"Not found."},{status:404});
  const expected=process.env.AFFILIATE_OUTBOX_CRON_SECRET;
  if(!expected||request.headers.get("authorization")!==`Bearer ${expected}`) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const adapter=new TelegramBotAdapter(process.env.AFFILIATE_TELEGRAM_BOT_TOKEN||"",process.env.AFFILIATE_TELEGRAM_CHAT_ID||"");
    const admin=getSupabaseAdminClient();
    await admin.from("affiliate_telegram_publications").update({status:"unknown_delivery",last_error:"AFFILIATE_TELEGRAM_WORKER_INTERRUPTED",locked_at:null,locked_by:null}).eq("status","processing").lt("locked_at",new Date(Date.now()-15*60*1000).toISOString());
    const allowedTypes=["daily_content","rule_change"];
    if(affiliateOperationalFlagEnabled(process.env,"AFFILIATE_TELEGRAM_WINS")) allowedTypes.push("qualified_sale");
    if(affiliateOperationalFlagEnabled(process.env,"AFFILIATE_TELEGRAM_PAYOUT_NOTICE")) allowedTypes.push("payout_notice");
    const worker=crypto.randomUUID();
    const {data:rows,error}=await admin.rpc("affiliate_claim_telegram_publications",{p_worker:worker,p_types:allowedTypes,p_limit:5});
    if(error) throw error;
    const results=[];
    for(const row of rows||[]){
      const {data:version,error:versionError}=await admin.from("affiliate_content_versions").select("body,status").eq("id",row.content_version_id).maybeSingle();
      if(versionError||!version){await admin.from("affiliate_telegram_publications").update({status:"dead_letter",last_error:"AFFILIATE_TELEGRAM_CONTENT_MISSING",locked_at:null,locked_by:null}).eq("id",row.id).eq("status","processing").eq("locked_by",worker);continue;}
      const body=version?.body as {body?:string}|undefined;
      let consent=row.publication_type==="daily_content"||row.publication_type==="rule_change";
      let saleQualified=false; let payoutPaid=false; let payoutReconciled=false;
      if(row.publication_type==="qualified_sale"&&row.subject_ref){const {data:sale}=await admin.from("affiliate_sales").select("status,attribution_id,affiliate_attributions!inner(affiliate_id,affiliate_memberships!inner(privacy_consent))").eq("id",row.subject_ref).maybeSingle();saleQualified=sale?.status==="qualified";const attribution=Array.isArray(sale?.affiliate_attributions)?sale.affiliate_attributions[0]:sale?.affiliate_attributions;const membership=Array.isArray(attribution?.affiliate_memberships)?attribution.affiliate_memberships[0]:attribution?.affiliate_memberships;consent=membership?.privacy_consent===true;}
      if(row.publication_type==="payout_notice"&&row.subject_ref){const {data:batch}=await admin.from("affiliate_payout_batches").select("status,paid_at,reconciled_at").eq("id",row.subject_ref).maybeSingle();payoutPaid=batch?.status==="reconciled"&&Boolean(batch.paid_at);payoutReconciled=Boolean(batch?.reconciled_at);consent=true;}
      const publication:TelegramPublication={id:row.id,kind:row.publication_type,consent,contentStatus:version?.status||"draft",saleQualified,payoutPaid,payoutReconciled};
      const result=await dispatchTelegram({publication,renderedBody:body?.body||JSON.stringify(version?.body||{}),attempts:row.attempt_count},adapter);
      if(result.status==="sent") await admin.from("affiliate_telegram_publications").update({status:"sent",external_message_ref:result.externalMessageRef,attempt_count:row.attempt_count+1,last_error:null,locked_at:null,locked_by:null}).eq("id",row.id).eq("status","processing").eq("locked_by",worker);
      else if(result.status==="unknown_delivery") await admin.from("affiliate_telegram_publications").update({status:"unknown_delivery",attempt_count:row.attempt_count+1,last_error:result.error,locked_at:null,locked_by:null}).eq("id",row.id).eq("status","processing").eq("locked_by",worker);
      else if(result.status==="dead_letter") {await admin.from("affiliate_telegram_publications").update({status:"dead_letter",attempt_count:5,last_error:"Maximum attempts reached",locked_at:null,locked_by:null}).eq("id",row.id).eq("status","processing").eq("locked_by",worker);const {data:event}=await admin.from("affiliate_outbox_events").upsert({program_id:"secwyn-india",aggregate_type:"telegram_publication",aggregate_id:row.id,event_type:"affiliate.telegram.dead_letter",payload:{publicationId:row.id},idempotency_key:`telegram-dead-letter:${row.id}`,status:"dead_letter"},{onConflict:"program_id,idempotency_key"}).select("id").single();if(event) await admin.from("affiliate_dead_letters").upsert({outbox_event_id:event.id,reason:"TELEGRAM_MAX_ATTEMPTS",payload:{publicationId:row.id}},{onConflict:"outbox_event_id"});}
      else await admin.from("affiliate_telegram_publications").update({status:"pending",attempt_count:result.attempts,last_error:result.error,scheduled_at:new Date(Date.now()+result.retryAfterSeconds*1000).toISOString(),locked_at:null,locked_by:null}).eq("id",row.id).eq("status","processing").eq("locked_by",worker);
      results.push({id:row.id,status:result.status});
    }
    return NextResponse.json({processed:results.length,results});
  }catch{return NextResponse.json({error:"Affiliate Telegram worker failed closed."},{status:503});}
}
