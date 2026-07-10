import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { costControlCheck } from "@/lib/cost-control";
import { calculateRiskScore } from "@/lib/risk-engine";
import { sanitizeSingleRiskPayloadForPlan } from "@/lib/plans";
import { consumeLegacyCredits } from "@/lib/legacy-credits";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ");
let _supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const { createClient } = require("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ";
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
  const apiKey = req.headers.get("authorization")?.replace("Bearer ", "") || "";

  let body: { ip?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const requestIP = body.ip?.trim();
  if (!requestIP) return NextResponse.json({ error: "IP is required" }, { status: 400 });

  const cc = await costControlCheck({ apiKey, endpoint: "ip/check", ip });
  if (!cc.allowed) {
    return NextResponse.json({ error: cc.errorCode, message: cc.errorMessage }, { status: 429 });
  }

  const legacyCreditResult = await consumeLegacyCredits({
    supabase: getSupabaseAdmin(),
    userId: cc.userId,
    requiredCredits: 1,
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

  const riskResult = await calculateRiskScore({ ip: requestIP });

  const rawResult = {
    success: true,
    ip: requestIP,
    input: requestIP,
    type: "ip",
    risk_score: riskResult.score,
    reasons: riskResult.reasons,
    decision: riskResult.decision,
    details: { email: null, ip: riskResult.ipDetails },
    cost: {
      units_consumed: cc.costUnits,
      credits_deducted: legacyCreditResult.deducted,
      required_credits: legacyCreditResult.requiredCredits,
      credits_available_before: legacyCreditResult.creditsAvailable,
      monthly_remaining: cc.monthlyRemaining,
      daily_remaining: cc.dailyRemaining,
    },
  };
  const result = sanitizeSingleRiskPayloadForPlan(rawResult, cc.plan || "free");
  (result as any).ip = requestIP;

  getSupabaseAdmin().from("checks").insert({
    user_id: cc.userId, check_type: "ip", input_value: requestIP,
    risk_score: riskResult.score, result_json: result,
  }).then(() => {});

  return NextResponse.json(result);
}
