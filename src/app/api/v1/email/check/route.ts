import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { costControlCheck } from "@/lib/cost-control";
import { calculateRiskScore } from "@/lib/risk-engine";

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

  const cc = await costControlCheck({ apiKey, endpoint: "email/check", ip });
  if (!cc.allowed) {
    return NextResponse.json({ error: cc.errorCode, message: cc.errorMessage }, { status: 429 });
  }

  let body: { email?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const riskResult = await calculateRiskScore({ email, shouldCheckMX: true });

  const result = {
    success: true,
    email,
    valid: !riskResult.reasons.includes("Invalid email format"),
    disposable: riskResult.emailDetails?.isDisposable ?? false,
    domain: riskResult.emailDetails?.domain ?? "",
    risk_score: riskResult.score,
    reasons: riskResult.reasons,
    decision: riskResult.decision,
    details: riskResult.emailDetails,
    cost: {
      units_consumed: cc.costUnits,
      monthly_remaining: cc.monthlyRemaining,
      daily_remaining: cc.dailyRemaining,
    },
  };

  getSupabaseAdmin().from("checks").insert({
    user_id: cc.userId, check_type: "email", input_value: email,
    risk_score: riskResult.score, result_json: result,
  }).then(() => {});

  return NextResponse.json(result);
}
