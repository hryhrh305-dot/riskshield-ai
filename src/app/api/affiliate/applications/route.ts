import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { affiliateFlagEnabled } from "@/modules/affiliate";
import { requireAffiliateUser } from "@/modules/affiliate/application/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!affiliateFlagEnabled(process.env, "AFFILIATE_APPLICATIONS")) return NextResponse.json({ error: "Affiliate applications are not open." }, { status: 404 });
  try {
    const user = await requireAffiliateUser();
    const contentType = request.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await request.json() : Object.fromEntries((await request.formData()).entries());
    if (typeof body.background !== "string" || typeof body.promotion_plan !== "string" || body.background.length > 2000 || body.promotion_plan.length > 2000) return NextResponse.json({ error: "Invalid application." }, { status: 400 });
    if (!(body.independent_disclosure === true || body.independent_disclosure === "on") || !(body.anti_spam === true || body.anti_spam === "on")) return NextResponse.json({ error: "Required disclosures were not accepted." }, { status: 400 });
    const quiz={relationship:body.quiz_relationship,disclosure:body.quiz_disclosure,outreach:body.quiz_outreach,claims:body.quiz_claims,stop:body.quiz_stop};
    const expected={relationship:"independent",disclosure:"always",outreach:"consent",claims:"evidence",stop:"stop"};const quizScore=Object.entries(expected).filter(([key,value])=>quiz[key as keyof typeof quiz]===value).length;
    const hash=(value:string)=>createHash("sha256").update(value).digest("hex");const correlationId=crypto.randomUUID();const admin = getSupabaseAdminClient();
    const { error } = await admin.rpc("affiliate_submit_application",{p_user_id:user.id,p_answers:{background:body.background,promotionPlan:body.promotion_plan,independentDisclosure:true,antiSpam:true,quiz},p_policy_version:"secwyn-india-policy-v1",p_quiz_version:"secwyn-india-quiz-v1",p_quiz_score:quizScore,p_ip_hash:hash(request.headers.get("x-forwarded-for")||"unavailable"),p_user_agent_hash:hash(request.headers.get("user-agent")||"unavailable"),p_correlation_id:correlationId});
    if (error) throw error;
    if (contentType.includes("application/json")) return NextResponse.json({ ok: true }, { status: 201 });
    return NextResponse.redirect(new URL("/affiliate/portal", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AFFILIATE_APPLICATION_FAILED";
    return NextResponse.json({ error: message === "AFFILIATE_AUTH_REQUIRED" ? "Authentication required." : "Application could not be saved." }, { status: message === "AFFILIATE_AUTH_REQUIRED" ? 401 : 500 });
  }
}
