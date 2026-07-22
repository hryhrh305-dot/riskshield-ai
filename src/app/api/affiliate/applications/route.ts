import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { affiliateFlagEnabled, assertAffiliateSameOrigin } from "@/modules/affiliate";
import { requireAffiliateUser } from "@/modules/affiliate/application/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!affiliateFlagEnabled(process.env, "AFFILIATE_APPLICATIONS")) return NextResponse.json({ error: "Affiliate applications are not open." }, { status: 404 });
  try {
    assertAffiliateSameOrigin(request);
    const user = await requireAffiliateUser();
    const contentType = request.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await request.json() : Object.fromEntries((await request.formData()).entries());
    if (typeof body.background !== "string" || typeof body.promotion_plan !== "string" || body.background.length > 2000 || body.promotion_plan.length > 2000) return NextResponse.json({ error: "Invalid application." }, { status: 400 });
    if (!(body.independent_disclosure === true || body.independent_disclosure === "on") || !(body.anti_spam === true || body.anti_spam === "on")) return NextResponse.json({ error: "Required disclosures were not accepted." }, { status: 400 });
    const quiz={relationship:body.quiz_relationship,disclosure:body.quiz_disclosure,outreach:body.quiz_outreach,claims:body.quiz_claims,stop:body.quiz_stop};
    const expected={relationship:"independent",disclosure:"always",outreach:"consent",claims:"evidence",stop:"stop"};const quizScore=Object.entries(expected).filter(([key,value])=>quiz[key as keyof typeof quiz]===value).length;
    const hash=(value:string)=>createHash("sha256").update(value).digest("hex");const correlationId=crypto.randomUUID();const admin = getSupabaseAdminClient();
    const {data:existing}=await admin.from("affiliate_applications").select("id").eq("program_id","secwyn-india").eq("user_id",user.id).maybeSingle();
    if(existing){const since=new Date(Date.now()-60*60*1000).toISOString();const {count}=await admin.from("affiliate_quiz_attempts").select("id",{count:"exact",head:true}).eq("application_id",existing.id).gte("created_at",since);if((count||0)>=10) throw new Error("AFFILIATE_APPLICATION_RATE_LIMITED");}
    const answers={background:body.background,promotionPlan:body.promotion_plan,independentDisclosure:true,antiSpam:true,quiz};
    const requestHash=hash(JSON.stringify(answers));
    const requestId=request.headers.get("idempotency-key")?.trim()||requestHash;
    const { error } = await admin.rpc("affiliate_submit_application_v2",{p_user_id:user.id,p_answers:answers,p_policy_version:"secwyn-india-policy-v1",p_quiz_version:"secwyn-india-quiz-v1",p_quiz_score:quizScore,p_ip_hash:hash(request.headers.get("x-forwarded-for")||"unavailable"),p_user_agent_hash:hash(request.headers.get("user-agent")||"unavailable"),p_correlation_id:correlationId,p_request_id:requestId,p_request_hash:requestHash});
    if (error) throw error;
    if (contentType.includes("application/json")) return NextResponse.json({ ok: true }, { status: 201 });
    return NextResponse.redirect(new URL("/affiliate/portal", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AFFILIATE_APPLICATION_FAILED";
    const status=message==="AFFILIATE_AUTH_REQUIRED"?401:message==="AFFILIATE_CSRF_REJECTED"?403:message==="AFFILIATE_APPLICATION_RATE_LIMITED"?429:message.includes("AFFILIATE_IDEMPOTENCY_CONFLICT")?409:500;
    return NextResponse.json({ error: status===401?"Authentication required.":status===403?"Request origin could not be verified.":status===429?"Too many application attempts. Try again later.":status===409?"This request conflicts with an earlier submission.":"Application could not be saved." }, { status });
  }
}
