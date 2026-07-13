import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { costControlCheck } from "@/lib/cost-control";
import { calculateRiskScore, checkDomainAge, calculateCompanyHealth, cleanEmail } from "@/lib/risk-engine";
import { sanitizeSingleRiskPayloadForPlan, shouldUseDeepDetection } from "@/lib/plans";
import { consumeLegacyCredits } from "@/lib/legacy-credits";
import { buildCreditRequestId } from "@/lib/credit-accounting";

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

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
  const authHeader = req.headers.get("authorization") || "";
  const apiKey = req.headers.get("x-api-key") || (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader);

  let body: { email?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawEmail = body.email?.trim() || null;
  const email = cleanEmail(rawEmail);
  if (!email) {
    if (rawEmail) {
      return NextResponse.json({ error: "Invalid email format. Please provide a valid email like user@example.com." }, { status: 400 });
    }
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const cc = await costControlCheck({ apiKey, endpoint: "email/check", ip });
  if (!cc.allowed) {
    return NextResponse.json({ error: cc.errorCode, message: cc.errorMessage }, { status: 429 });
  }

  const legacyCreditResult = await consumeLegacyCredits({
    supabase: getSupabaseAdmin(),
    userId: cc.userId,
    requiredCredits: 1,
    requestId: buildCreditRequestId(req, "email-check"),
    reason: "api_audit",
    requestFingerprint: { email },
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

  const useDeepDetection = shouldUseDeepDetection(cc.plan || "free");
  const domain = email.split("@")[1]?.toLowerCase() || null;
  const domainAge = (domain && useDeepDetection) ? await checkDomainAge(domain).catch(() => null) : null;
  const riskResult = await calculateRiskScore({
    email,
    shouldCheckMX: true,
    domainAgeDays: useDeepDetection ? (domainAge?.ageDays ?? null) : null,
  });
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

  const rawResult = {
    success: true,
    email,
    valid: !riskResult.reasons.includes("Invalid email format"),
    risk_score: riskResult.score,
    input: email,
    type: "email",
    reasons: riskResult.reasons,
    decision: riskResult.decision,
    domain_age: domainAge,
    company_health: companyHealth,
    details: { email: riskResult.emailDetails, ip: null },
    cost: {
      units_consumed: cc.costUnits,
      credits_deducted: legacyCreditResult.deducted,
      required_credits: legacyCreditResult.requiredCredits,
      credits_available_before: legacyCreditResult.creditsAvailable,
      credits_remaining: legacyCreditResult.creditsRemaining,
      monthly_remaining: cc.monthlyRemaining,
      daily_remaining: cc.dailyRemaining,
    },
  };
  const result = sanitizeSingleRiskPayloadForPlan(rawResult, cc.plan || "free");
  (result as any).valid = !riskResult.reasons.includes("Invalid email format");
  (result as any).email = email;
  (result as any).disposable = !!(result as any).details?.email?.isDisposable;
  (result as any).domain = ((result as any).details?.email?.domain as string) || "";

  getSupabaseAdmin().from("checks").insert({
    user_id: cc.userId, check_type: "email", input_value: email,
    risk_score: riskResult.score, result_json: result,
  }).then(() => {});

  return NextResponse.json(result);
}
