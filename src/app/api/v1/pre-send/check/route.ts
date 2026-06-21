import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { costControlCheck } from "@/lib/cost-control";
import { checkBlacklist, autoBlacklistIfHighRisk } from "@/lib/blacklist";
import { disposableDomains } from "@/lib/risk-engine";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ");
const supabaseAdmin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const batchCache = new Map<string, { result: Record<string, unknown>; ts: number }>();
const BATCH_CACHE_TTL = 300000;

function quickEmailCheck(email: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const [lp, dl] = email.split("@");
  if (!lp || !dl) { score += 50; reasons.push("Invalid format"); return { score, reasons }; }
  if (disposableDomains.has(dl.toLowerCase())) { score += 45; reasons.push("Disposable email"); }
  if (/^\d+$/.test(lp)) { score += 12; reasons.push("Numeric local part"); }
  if ((lp.match(/\./g) || []).length > 3) { score += 8; reasons.push("Excessive dots"); }
  if (email.length > 50) { score += 5; reasons.push("Long email"); }
  if (dl.length < 4) { score += 15; reasons.push("Short domain"); }
  return { score: Math.min(score, 100), reasons };
}

export async function POST(req: NextRequest) {
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
  const apiKey = req.headers.get("authorization")?.replace("Bearer ", "") || "";

  const cc = await costControlCheck({ apiKey, endpoint: "pre-send/check", ip: clientIP });
  if (!cc.allowed) {
    return NextResponse.json({ success: false, error: cc.errorCode, message: cc.errorMessage }, { status: 429 });
  }

  let body: { emails?: string[]; ip?: string; campaign_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  // MAX BATCH SIZE: 1000 emails
  const emails = (body.emails || []).slice(0, 1000);
  const targetIP = body.ip?.trim() || null;
  if (!emails.length) return NextResponse.json({ success: false, error: "emails array is required" }, { status: 400 });

  const results: Array<{ email: string; decision: string; score: number; reasons: string[]; blacklisted: boolean }> = [];
  let blockedCount = 0;

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();
    if (!email) continue;

    const cacheKey = email + (targetIP || "");
    const cached = batchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < BATCH_CACHE_TTL) {
      results.push(cached.result as typeof results[0]);
      if ((cached.result as Record<string, unknown>).decision === "BLOCK") blockedCount++;
      continue;
    }

    const blHit = await checkBlacklist("email", email);
    if (blHit) {
      const r = { email, decision: "BLOCK", score: Number(blHit.risk_score) || 90, reasons: ["Blacklisted: " + (blHit.reason || "known risk")], blacklisted: true };
      results.push(r); blockedCount++;
      batchCache.set(cacheKey, { result: r as unknown as Record<string, unknown>, ts: Date.now() });
      continue;
    }

    const local = quickEmailCheck(email);
    if (local.score >= 60) {
      const r = { email, decision: "BLOCK", score: local.score, reasons: local.reasons, blacklisted: false };
      results.push(r); blockedCount++;
      batchCache.set(cacheKey, { result: r as unknown as Record<string, unknown>, ts: Date.now() });
      if (local.score >= 85) autoBlacklistIfHighRisk({ type: "email", value: email, risk_score: local.score, reasons: local.reasons }).catch(() => {});
      continue;
    }

    const decision = local.score >= 30 ? "REVIEW" : "ALLOW";
    const r = { email, decision, score: local.score, reasons: local.reasons, blacklisted: false };
    results.push(r);
    batchCache.set(cacheKey, { result: r as unknown as Record<string, unknown>, ts: Date.now() });
  }

  const total = results.length;
  const allowed = total - blockedCount;
  const campaignRisk = blockedCount > total * 0.3 ? "HIGH" : blockedCount > total * 0.1 ? "MEDIUM" : "LOW";

  supabaseAdmin.from("risk_logs").insert({
    user_id: cc.userId,
    ip: targetIP,
    email: JSON.stringify(emails.slice(0, 5)) + "...",
    risk_score: Math.round((blockedCount / total) * 100),
    decision: campaignRisk,
    source: "pre-send-batch",
    cost_units: cc.costUnits,
  }).then(() => {});

  return NextResponse.json({
    success: true,
    request_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    summary: { total, allowed, blocked: blockedCount },
    campaign_risk: campaignRisk,
    campaign_id: body.campaign_id || null,
    results,
    cost: {
      units_consumed: cc.costUnits,
      monthly_remaining: cc.monthlyRemaining,
      daily_remaining: cc.dailyRemaining,
    },
    rate_limit: {
      ip_remaining: cc.ipRemaining,
      daily_remaining: cc.dailyRemaining,
      monthly_remaining: cc.monthlyRemaining,
    },
  });
}
