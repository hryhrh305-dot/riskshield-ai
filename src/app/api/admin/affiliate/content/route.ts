import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { affiliateOperationalFlagEnabled, checkContentImpact } from "@/modules/affiliate";
import { requireAffiliateOperator, type AffiliateOperatorRole } from "@/modules/affiliate/application/server";

async function requireContentRole(allowed:readonly AffiliateOperatorRole[]) {
  if(!affiliateOperationalFlagEnabled(process.env,"AFFILIATE_CONTENT_ADMIN")) throw new Error("NOT_FOUND");
  try{return (await requireAffiliateOperator(allowed)).user;}catch(error){if(error instanceof Error&&error.message==="AFFILIATE_AUTH_REQUIRED") throw error;throw new Error("FORBIDDEN");}
}
function contentError(error:unknown,fallback:string){const code=error instanceof Error?error.message:"";return NextResponse.json({error:code==="NOT_FOUND"?"Not found.":code==="FORBIDDEN"?"Forbidden.":code==="AFFILIATE_AUTH_REQUIRED"?"Authentication required.":fallback},{status:code==="NOT_FOUND"?404:code==="FORBIDDEN"?403:code==="AFFILIATE_AUTH_REQUIRED"?401:500});}

export async function GET() {
  try {
    await requireContentRole(["content_editor","compliance_reviewer","program_manager","publisher","super_admin"]);
    const admin=getSupabaseAdminClient();
    const {data,error}=await admin.from("affiliate_content_items").select("id,content_key,content_type,locale,affiliate_content_versions(id,version,status,body,variables,checksum,publish_at,published_at,created_at,affiliate_content_impacts(status,requires_rule_review,requires_telegram_sync))").eq("program_id","secwyn-india").order("content_key");
    if(error) throw error;
    return NextResponse.json({items:data});
  } catch(error){return contentError(error,"Content export failed.");}
}

export async function POST(request: Request) {
  try {
    const user = await requireContentRole(["content_editor","program_manager","super_admin"]);
    const input = await request.json();
    if (typeof input.contentKey !== "string" || typeof input.body !== "object" || !input.body) return NextResponse.json({ error: "Invalid content." }, { status: 400 });
    const admin = getSupabaseAdminClient();
    const { data: item, error: itemError } = await admin.from("affiliate_content_items").upsert({ program_id: "secwyn-india", content_key: input.contentKey, content_type: input.contentType || "script", locale: input.locale || "en" }, { onConflict: "program_id,content_key,locale" }).select("id").single();
    if (itemError) throw itemError;
    const { data: previous } = await admin.from("affiliate_content_versions").select("version,body").eq("content_id", item.id).order("version", { ascending: false }).limit(1).maybeSingle();
    const serialized = JSON.stringify(input.body);
    const impact = checkContentImpact(previous ? JSON.stringify(previous.body) : "", serialized);
    const checksum = createHash("sha256").update(serialized).digest("hex");
    const { data: version, error } = await admin.from("affiliate_content_versions").insert({ content_id: item.id, version: (previous?.version || 0) + 1, status: "draft", body: input.body, variables: input.variables || [], checksum, created_by: user.id }).select("id,version,status").single();
    if (error) throw error;
    await admin.from("affiliate_content_impacts").insert({ content_version_id: version.id, requires_rule_review: impact.requiresRuleReview, requires_telegram_sync: impact.requiresTelegramSync });
    return NextResponse.json({ version, impact }, { status: 201 });
  } catch (error) { return contentError(error,"Content version could not be created."); }
}

export async function PATCH(request:Request){
  try{
    const input=await request.json();
    if(typeof input.versionId!=="string"||!["approve","schedule","publish","retire","rollback","resolve_impact"].includes(input.action)) return NextResponse.json({error:"Invalid action."},{status:400});
    const reviewActions=["approve","resolve_impact"];
    const user=await requireContentRole(reviewActions.includes(input.action)?["compliance_reviewer","program_manager","super_admin"]:["publisher","program_manager","super_admin"]);
    const admin=getSupabaseAdminClient();
    const {data:current,error:loadError}=await admin.from("affiliate_content_versions").select("*,affiliate_content_items!inner(program_id)").eq("id",input.versionId).eq("affiliate_content_items.program_id","secwyn-india").single();
    if(loadError||!current) return NextResponse.json({error:"Version not found."},{status:404});
    if(input.action==="resolve_impact"){const {error}=await admin.from("affiliate_content_impacts").update({status:"reviewed",reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("content_version_id",current.id);if(error) throw error;return NextResponse.json({impact:"reviewed"});}
    if(["published","retired","rolled_back"].includes(current.status)&&input.action!=="rollback") return NextResponse.json({error:"Published content is immutable; create a new version."},{status:409});
    let update:Record<string,unknown>={};
    if(input.action==="approve") update={status:"approved",approved_by:user.id,approved_at:new Date().toISOString()};
    if(input.action==="schedule") {const minutes=Number(input.scheduleInMinutes);if(!Number.isFinite(minutes)||minutes<1||minutes>525600) return NextResponse.json({error:"A valid schedule delay is required."},{status:400});update={status:"scheduled",publish_at:new Date(Date.now()+minutes*60000).toISOString(),approved_by:user.id,approved_at:new Date().toISOString()};}
    if(input.action==="publish") {if(!["approved","scheduled"].includes(current.status)) return NextResponse.json({error:"Approval is required before publishing."},{status:409});const {data,error}=await admin.rpc("affiliate_publish_content",{p_version_id:current.id,p_actor_id:user.id,p_correlation_id:crypto.randomUUID()});if(error) return NextResponse.json({error:"Content impact review or variable resolution is incomplete."},{status:409});return NextResponse.json({version:data});}
    if(input.action==="retire") update={status:"retired"};
    if(input.action==="rollback"){
      if(typeof input.targetVersionId!=="string") return NextResponse.json({error:"Rollback target required."},{status:400});
      const {data:target,error:targetError}=await admin.from("affiliate_content_versions").select("id,body,variables,checksum,content_id,version").eq("id",input.targetVersionId).eq("content_id",current.content_id).single();
      if(targetError||!target) return NextResponse.json({error:"Rollback target not found."},{status:404});
      const {data:created,error}=await admin.from("affiliate_content_versions").insert({content_id:current.content_id,version:current.version+1,status:"draft",body:target.body,variables:target.variables,checksum:createHash("sha256").update(JSON.stringify(target.body)+`:rollback:${current.version+1}`).digest("hex"),rollback_of:target.id,created_by:user.id}).select("id,version,status").single();
      if(error) throw error; return NextResponse.json({version:created});
    }
    const {data,error}=await admin.from("affiliate_content_versions").update(update).eq("id",current.id).select("id,version,status,publish_at,published_at").single();
    if(error) throw error;
    return NextResponse.json({version:data});
  }catch(error){return contentError(error,"Content transition failed.");}
}
