import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { costControlCheck } from "@/lib/cost-control";
import { createResponse } from "@/lib/response";
import { calculateRiskScore, checkDomainAge, calculateCompanyHealth, getAIExplanation } from "@/lib/risk-engine";
import { sanitizeSingleRiskPayloadForPlan, shouldUseAiExplanation, shouldUseDeepDetection } from "@/lib/plans";
import { consumeLegacyCredits } from "@/lib/legacy-credits";
import { buildCreditRequestId } from "@/lib/credit-accounting";
import { attachCanonicalDecisionResult } from "@/lib/decision-contract";
import { getPlanEntitlements } from "@/lib/plan-entitlements";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SECRET_KEY || "");
let _supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const { createClient } = require("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
    const key = process.env.SUPABASE_SECRET_KEY || "";
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "127.0.0.1";
  const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "") || "";

  // Parse body
  let body: { email?: string; ip?: string } = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email || null;
  const requestIP = body.ip || ip;

  const cc = await costControlCheck({ apiKey, endpoint: "risk/check", ip });
  if (!cc.allowed) {
    return NextResponse.json({ error: cc.errorCode, message: cc.errorMessage }, { status: 429 });
  }
  const entitlements = getPlanEntitlements({ plan: cc.plan || "free", subscriptionStatus: "active" });
  if (!entitlements.apiAccess) {
    return NextResponse.json({ error: "API_ACCESS_REQUIRED", message: "API access starts on Growth." }, { status: 403 });
  }

  const legacyCreditResult = await consumeLegacyCredits({
    supabase: getSupabaseAdmin(),
    userId: cc.userId!,
    requiredCredits: 1,
    requestId: buildCreditRequestId(request, "risk-check"),
    reason: "api_audit",
    requestFingerprint: { email, ip: requestIP },
  });
  if (!legacyCreditResult.ok) {
    const isInsufficient = legacyCreditResult.error === "INSUFFICIENT_CREDITS";
    return NextResponse.json({
      error: "Insufficient credits",
      message: isInsufficient ? "Insufficient credits." : "Failed to process credit. Please try again.",
      upgradeNeeded: isInsufficient,
      requiredCredits: legacyCreditResult.requiredCredits,
      creditsAvailable: legacyCreditResult.creditsAvailable,
    }, { status: isInsufficient ? 429 : 500 });
  }

  // ---- Risk Scoring Engine ----
  const useDeepDetection = shouldUseDeepDetection(cc.plan || "free");
  const domain = email ? email.split("@")[1]?.toLowerCase() || null : null;
  const domainAge = (domain && useDeepDetection) ? await checkDomainAge(domain).catch(() => null) : null;
  const riskResult = await calculateRiskScore({
    email,
    ip: requestIP,
    domainAgeDays: useDeepDetection ? (domainAge?.ageDays ?? null) : null,
  });

  // ---- AI (Layer 4: only for score >= 70) ----
  const aiReason = shouldUseAiExplanation(cc.plan || "free")
    ? await getAIExplanation(email, requestIP, riskResult.score, riskResult.reasons, cc.plan || "free")
    : null;
  const companyHealth = (domain && domainAge && useDeepDetection)
    ? await calculateCompanyHealth({
        riskScore: riskResult.score,
        isDisposable: !!riskResult.emailDetails?.isDisposable,
        hasMX: !!riskResult.emailDetails?.hasMX,
        hasSPF: !!riskResult.emailDetails?.hasSPF,
        hasDMARC: !!riskResult.emailDetails?.hasDMARC,
        dmarcPolicy: (riskResult.emailDetails?.dmarcPolicy as string) || "none",
        domainAgeDays: domainAge.ageDays,
        isProxy: !!riskResult.ipDetails?.isProxy,
        isHosting: !!riskResult.ipDetails?.isHosting,
        blacklistHits: riskResult.blacklistHits || [],
        country: (riskResult.ipDetails?.countryCode as string) || null,
      }).catch(() => null)
    : null;

  // ---- Build Response ----
  const result = createResponse({
    score: riskResult.score,
    reasons: riskResult.reasons,
    email: email || null,
    ip: requestIP || null,
    emailDetails: riskResult.emailDetails,
    ipDetails: riskResult.ipDetails,
    aiReason: aiReason || undefined,
    ipRemaining: cc.ipRemaining,
    dailyRemaining: cc.dailyRemaining,
    monthlyRemaining: cc.monthlyRemaining,
  });

  // Add cost info
  (result as any).cost = {
    units_consumed: cc.costUnits,
    credits_deducted: legacyCreditResult.deducted,
    required_credits: legacyCreditResult.requiredCredits,
    credits_available_before: legacyCreditResult.creditsAvailable,
    credits_remaining: legacyCreditResult.creditsRemaining,
    monthly_remaining: cc.monthlyRemaining,
    daily_remaining: cc.dailyRemaining,
    per_minute_remaining: cc.perMinuteRemaining,
  };
  (result as any).domain_age = domainAge;
  (result as any).company_health = companyHealth;
  const rawPayload = result as unknown as Record<string, unknown>;
  const sanitizedPayload = sanitizeSingleRiskPayloadForPlan(rawPayload, cc.plan || "free");
  const sanitizedResult = attachCanonicalDecisionResult(sanitizedPayload, rawPayload).record;
  (sanitizedResult as any).cost = (result as any).cost;

  // Async: save risk log
  getSupabaseAdmin().from("risk_logs").insert({
    user_id: cc.userId,
    ip: requestIP,
    email: email || null,
    risk_score: riskResult.score,
    decision: riskResult.decision,
    reasons: riskResult.reasons,
    blacklist_hits: riskResult.blacklistHits,
    ipqs_response: riskResult.ipDetails,
    cost_units: cc.costUnits,
    created_at: new Date().toISOString(),
  }).then(() => {});

  // Async: trigger webhook if user has one configured
  getSupabaseAdmin().from("profiles").select("webhook_url").eq("id", cc.userId).single().then(({ data: profile }: any) => {
    if (profile?.webhook_url) {
      fetch(profile.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "risk_check_completed",
          timestamp: new Date().toISOString(),
          email: email || null,
          ip: requestIP || null,
          risk_score: riskResult.score,
          decision: riskResult.decision,
          reasons: riskResult.reasons,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }
  }).then(() => { /* fire and forget */ });

  return NextResponse.json(sanitizedResult, { status: 200 });
}
