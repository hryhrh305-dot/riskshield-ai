import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  affiliateOperationalFlagEnabled,
  assertAffiliateSameOrigin,
  dispatchTelegram,
  isAffiliatePreviewRuntime,
  TelegramBotAdapter,
  type TelegramPublication,
} from "@/modules/affiliate";
import { requireAffiliateOperator } from "@/modules/affiliate/application/server";

const CONFIRMATION="SEND ONE PRIVATE PREVIEW CANARY";

export async function POST(request:Request){
  if(!isAffiliatePreviewRuntime(process.env)||!affiliateOperationalFlagEnabled(process.env,"AFFILIATE_ADMIN")) return NextResponse.json({error:"Not found."},{status:404});
  try{assertAffiliateSameOrigin(request);}catch{return NextResponse.json({error:"Request origin could not be verified."},{status:403});}
  let operator;try{operator=await requireAffiliateOperator(["super_admin"]);}catch{return NextResponse.json({error:"Forbidden."},{status:403});}
  const input=await request.json() as {publicationId?:unknown;confirmation?:unknown};
  if(typeof input.publicationId!=="string"||input.confirmation!==CONFIRMATION) return NextResponse.json({error:"Explicit private-canary confirmation is required."},{status:400});
  const admin=getSupabaseAdminClient();const worker=`preview-canary:${crypto.randomUUID()}`;
  const {data:claimed,error:claimError}=await admin.from("affiliate_telegram_publications").update({status:"processing",locked_at:new Date().toISOString(),locked_by:worker}).eq("id",input.publicationId).eq("status","pending").select("*").maybeSingle();
  if(claimError) return NextResponse.json({error:"Private canary could not be claimed."},{status:503});
  if(!claimed){const {data:existing}=await admin.from("affiliate_telegram_publications").select("status,external_message_ref").eq("id",input.publicationId).maybeSingle();if(existing?.status==="sent") return NextResponse.json({status:"already_sent",messageRef:existing.external_message_ref});return NextResponse.json({error:"Private canary is not pending."},{status:409});}
  try{
    if(claimed.publication_type!=="daily_content"||!claimed.content_version_id) throw new Error("AFFILIATE_TELEGRAM_CANARY_TYPE_DENIED");
    const {data:version}=await admin.from("affiliate_content_versions").select("id,content_id,status,body").eq("id",claimed.content_version_id).maybeSingle();
    if(!version||!["approved","published"].includes(version.status)) throw new Error("AFFILIATE_TELEGRAM_CONTENT_NOT_APPROVED");
    const {data:item}=await admin.from("affiliate_content_items").select("content_key,program_id").eq("id",version.content_id).maybeSingle();
    if(!item||item.program_id!=="secwyn-india"||item.content_key!=="preview.private-telegram-canary") throw new Error("AFFILIATE_TELEGRAM_CANARY_CONTENT_DENIED");
    const adapter=new TelegramBotAdapter(process.env.AFFILIATE_TELEGRAM_BOT_TOKEN||"",process.env.AFFILIATE_TELEGRAM_CHAT_ID||"");
    const target=await adapter.assertPrivateCanaryTarget();
    const publication:TelegramPublication={id:claimed.id,kind:"daily_content",consent:true,contentStatus:version.status};
    const body=version.body as {body?:unknown};
    const result=await dispatchTelegram({publication,renderedBody:typeof body.body==="string"?body.body:JSON.stringify(version.body),attempts:claimed.attempt_count},adapter);
    if(result.status==="sent"){
      await admin.from("affiliate_telegram_publications").update({status:"sent",external_message_ref:result.externalMessageRef,attempt_count:claimed.attempt_count+1,last_error:null,locked_at:null,locked_by:null}).eq("id",claimed.id).eq("locked_by",worker);
      await admin.from("affiliate_audit_log").insert({actor_id:operator.user.id,action:"preview_private_telegram_canary",object_type:"affiliate_telegram_publication",object_id:claimed.id,after_state:{status:"sent",targetTitle:target.title},correlation_id:crypto.randomUUID()});
      return NextResponse.json({status:"sent",messageRef:result.externalMessageRef,target:target.title});
    }
    if(result.status==="unknown_delivery"){
      await admin.from("affiliate_telegram_publications").update({status:"unknown_delivery",attempt_count:claimed.attempt_count+1,last_error:result.error,locked_at:null,locked_by:null}).eq("id",claimed.id).eq("locked_by",worker);
      return NextResponse.json({status:"unknown_delivery"},{status:202});
    }
    await admin.from("affiliate_telegram_publications").update({status:result.status==="dead_letter"?"dead_letter":"pending",attempt_count:"attempts" in result?result.attempts:5,last_error:"error" in result?result.error:"Maximum attempts reached",scheduled_at:"retryAfterSeconds" in result?new Date(Date.now()+result.retryAfterSeconds*1000).toISOString():claimed.scheduled_at,locked_at:null,locked_by:null}).eq("id",claimed.id).eq("locked_by",worker);
    return NextResponse.json({status:result.status},{status:503});
  }catch(error){
    await admin.from("affiliate_telegram_publications").update({status:"pending",last_error:error instanceof Error?error.message:"AFFILIATE_TELEGRAM_CANARY_FAILED",locked_at:null,locked_by:null}).eq("id",claimed.id).eq("locked_by",worker);
    return NextResponse.json({error:"Private Telegram canary failed closed."},{status:503});
  }
}
