import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { costControlCheck } from "@/lib/cost-control";
import { calculateRiskScore } from "@/lib/risk-engine";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ");
const supabaseAdmin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
  const apiKey = req.headers.get("authorization")?.replace("Bearer ", "") || "";

  const cc = await costControlCheck({ apiKey, endpoint: "ip/check", ip });
  if (!cc.allowed) {
    return NextResponse.json({ error: cc.errorCode, message: cc.errorMessage }, { status: 429 });
  }

  let body: { ip?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const requestIP = body.ip?.trim();
  if (!requestIP) return NextResponse.json({ error: "IP is required" }, { status: 400 });

  const riskResult = await calculateRiskScore({ ip: requestIP });

  const result = {
    success: true,
    ip: requestIP,
    risk_score: riskResult.score,
    reasons: riskResult.reasons,
    decision: riskResult.decision,
    details: riskResult.ipDetails,
    cost: {
      units_consumed: cc.costUnits,
      monthly_remaining: cc.monthlyRemaining,
      daily_remaining: cc.dailyRemaining,
    },
  };

  supabaseAdmin.from("checks").insert({
    user_id: cc.userId, check_type: "ip", input_value: requestIP,
    risk_score: riskResult.score, result_json: result,
  }).then(() => {});

  return NextResponse.json(result);
}
