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
    const {data:rows,error}=await admin.from("affiliate_telegram_publications").select("id,publication_type,subject_ref,attempt_count,idempotency_key,affiliate_content_versions!inner(body,status)").eq("status","pending").lte("scheduled_at",new Date().toISOString()).order("scheduled_at").limit(5);
    if(error) throw error;
    const results=[];
    let dailyPublished=false;
    for(const row of rows||[]){
      if(row.publication_type==="qualified_sale"&&!affiliateOperationalFlagEnabled(process.env,"AFFILIATE_TELEGRAM_WINS")) continue;
      if(row.publication_type==="payout_notice"&&!affiliateOperationalFlagEnabled(process.env,"AFFILIATE_TELEGRAM_PAYOUT_NOTICE")) continue;
      if(row.publication_type==="daily_content"&&dailyPublished) continue;
      const version=Array.isArray(row.affiliate_content_versions)?row.affiliate_content_versions[0]:row.affiliate_content_versions;
      const body=version?.body as {body?:string}|undefined;
      let consent=row.publication_type==="daily_content"||row.publication_type==="rule_change";
      let saleQualified=false; let payoutPaid=false; let payoutReconciled=false;
      if(row.publication_type==="qualified_sale"&&row.subject_ref){const {data:sale}=await admin.from("affiliate_sales").select("status,attribution_id,affiliate_attributions!inner(affiliate_id,affiliate_memberships!inner(privacy_consent))").eq("id",row.subject_ref).maybeSingle();saleQualified=sale?.status==="qualified";const attribution=Array.isArray(sale?.affiliate_attributions)?sale.affiliate_attributions[0]:sale?.affiliate_attributions;const membership=Array.isArray(attribution?.affiliate_memberships)?attribution.affiliate_memberships[0]:attribution?.affiliate_memberships;consent=membership?.privacy_consent===true;}
      if(row.publication_type==="payout_notice"&&row.subject_ref){const {data:batch}=await admin.from("affiliate_payout_batches").select("status,paid_at,reconciled_at").eq("id",row.subject_ref).maybeSingle();payoutPaid=batch?.status==="reconciled"&&Boolean(batch.paid_at);payoutReconciled=Boolean(batch?.reconciled_at);consent=true;}
      const publication:TelegramPublication={id:row.id,kind:row.publication_type,consent,contentStatus:version?.status||"draft",saleQualified,payoutPaid,payoutReconciled};
      const result=await dispatchTelegram({publication,renderedBody:body?.body||JSON.stringify(version?.body||{}),attempts:row.attempt_count},adapter);
      if(result.status==="sent") await admin.from("affiliate_telegram_publications").update({status:"sent",external_message_ref:result.externalMessageRef,attempt_count:row.attempt_count+1,last_error:null}).eq("id",row.id);
      else if(result.status==="unknown_delivery") await admin.from("affiliate_telegram_publications").update({status:"unknown_delivery",attempt_count:row.attempt_count+1,last_error:result.error}).eq("id",row.id);
      else if(result.status==="dead_letter") {await admin.from("affiliate_telegram_publications").update({status:"dead_letter",attempt_count:5,last_error:"Maximum attempts reached"}).eq("id",row.id);const {data:event}=await admin.from("affiliate_outbox_events").upsert({program_id:"secwyn-india",aggregate_type:"telegram_publication",aggregate_id:row.id,event_type:"affiliate.telegram.dead_letter",payload:{publicationId:row.id},idempotency_key:`telegram-dead-letter:${row.id}`,status:"dead_letter"},{onConflict:"program_id,idempotency_key"}).select("id").single();if(event) await admin.from("affiliate_dead_letters").upsert({outbox_event_id:event.id,reason:"TELEGRAM_MAX_ATTEMPTS",payload:{publicationId:row.id}},{onConflict:"outbox_event_id"});}
      else await admin.from("affiliate_telegram_publications").update({attempt_count:result.attempts,last_error:result.error,scheduled_at:new Date(Date.now()+result.retryAfterSeconds*1000).toISOString()}).eq("id",row.id);
      results.push({id:row.id,status:result.status});
      if(row.publication_type==="daily_content"&&result.status==="sent") dailyPublished=true;
    }
    return NextResponse.json({processed:results.length,results});
  }catch{return NextResponse.json({error:"Affiliate Telegram worker failed closed."},{status:503});}
}
