import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { costControlCheck } from "@/lib/cost-control";
import { createResponse } from "@/lib/response";
import { calculateRiskScore, getAIExplanation } from "@/lib/risk-engine";

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

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "127.0.0.1";
  const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "") || "";

  // ---- UNIFIED COST CONTROL CHECK (7 steps) ----
  const cc = await costControlCheck({ apiKey, endpoint: "risk/check", ip });
  if (!cc.allowed) {
    return NextResponse.json({ error: cc.errorCode, message: cc.errorMessage }, { status: 429 });
  }

  // Parse body
  let body: { email?: string; ip?: string } = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email || null;
  const requestIP = body.ip || ip;

  // ---- Risk Scoring Engine ----
  const riskResult = await calculateRiskScore({ email, ip: requestIP });

  // ---- AI (Layer 4: only for score >= 70) ----
  const aiReason = await getAIExplanation(email, requestIP, riskResult.score, riskResult.reasons, cc.plan || "free");

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
    monthly_remaining: cc.monthlyRemaining,
    daily_remaining: cc.dailyRemaining,
    per_minute_remaining: cc.perMinuteRemaining,
  };

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

  return NextResponse.json(result, { status: 200 });
}
