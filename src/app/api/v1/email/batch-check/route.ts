import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateRiskScore, getCachedResult, setCachedResult, makeResultCacheKey } from "@/lib/risk-engine";
import { getPlanLimits, type PlanKey } from "@/lib/plans";
import { planCostLimits } from "@/lib/cost-control";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const supabaseAdmin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MAX_BATCH_SIZE = 100;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
  // Accept API key from X-API-Key header, Authorization Bearer, or body.api_key
  let apiKey = req.headers.get("x-api-key") || "";
  if (!apiKey) {
    const authHeader = req.headers.get("authorization") || "";
    apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  }

  // Validate API key
  const { data: keyRows, error: keyError } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, status")
    .eq("key", apiKey)
    .eq("status", "active")
    .limit(1);

  if (keyError || !keyRows || keyRows.length === 0) {
    return NextResponse.json({ error: "INVALID_API_KEY", message: "Invalid or revoked API key" }, { status: 401 });
  }
  
  const keyData = keyRows[0];

  // Get profile & plan limits
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, credits_remaining, subscription_status")
    .eq("id", keyData.user_id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 401 });
  }

  const planKey = (profile.plan || "free") as PlanKey;
  const limits = planCostLimits[planKey] || planCostLimits.free;

  // Parse body
  let body: { emails?: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emails = body.emails;
  if (!emails || !Array.isArray(emails)) {
    return NextResponse.json({ error: "emails array is required" }, { status: 400 });
  }
  if (emails.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: "Batch too large", message: "Max " + MAX_BATCH_SIZE + " emails per batch" }, { status: 400 });
  }

  // Filter valid emails
  // If API key still empty, try body
  if (!apiKey && (body as any).api_key) {
    apiKey = (body as any).api_key;
  }

  const validEmails = emails.map((e: string) => e.trim().toLowerCase()).filter((e: string) => e.includes("@") && e.split("@").length === 2);
  const batchSize = validEmails.length;

  // Check quotas
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const { data: monthLedger } = await supabaseAdmin
    .from("usage_ledger")
    .select("cost_units")
    .eq("user_id", keyData.user_id)
    .gte("created_at", startOfMonth);

  const monthlyUsed = (monthLedger || []).reduce((sum: number, r: any) => sum + (r.cost_units || 0), 0);
  if (monthlyUsed + batchSize > limits.monthlyUnits) {
    return NextResponse.json({
      error: "QUOTA_EXCEEDED",
      message: "Monthly quota exceeded. Remaining: " + Math.max(0, limits.monthlyUnits - monthlyUsed),
      monthly_remaining: Math.max(0, limits.monthlyUnits - monthlyUsed),
    }, { status: 429 });
  }

  const { data: dayLedger } = await supabaseAdmin
    .from("usage_ledger")
    .select("cost_units")
    .eq("user_id", keyData.user_id)
    .gte("created_at", today);

  const dailyUsed = (dayLedger || []).reduce((sum: number, r: any) => sum + (r.cost_units || 0), 0);
  if (dailyUsed + batchSize > limits.dailyUnits) {
    return NextResponse.json({
      error: "QUOTA_EXCEEDED",
      message: "Daily quota exceeded. Remaining: " + Math.max(0, limits.dailyUnits - dailyUsed),
      daily_remaining: Math.max(0, limits.dailyUnits - dailyUsed),
    }, { status: 429 });
  }

  // Process emails
  const results: any[] = [];
  let creditsConsumed = 0;

  for (const email of validEmails) {
    const cacheKey = makeResultCacheKey(email, null);
    const cached = getCachedResult(cacheKey);

    if (cached) {
      results.push({
        email,
        risk_score: cached.risk_score,
        health_score: (cached as any).company_health?.healthScore ?? 0,
        risk_level: cached.decision,
        reasons: cached.reasons || [],
        details: (cached as any).details?.email || null,
        cached: true,
      });
      continue;
    }

    const riskResult = await calculateRiskScore({ email, shouldCheckMX: true });

    const resultItem = {
      email,
      risk_score: riskResult.score,
      health_score: 0,
      risk_level: riskResult.decision,
      reasons: riskResult.reasons,
      details: riskResult.emailDetails,
      cached: false,
    };

    setCachedResult(cacheKey, {
      input: email,
      type: "email",
      risk_score: riskResult.score,
      decision: riskResult.decision,
      reasons: riskResult.reasons,
      details: { email: riskResult.emailDetails, ip: null },
      ai_explanation: null,
      domain_age: null,
      dns_health: null,
      company_health: null,
      impact: [],
      solution: [],
      cached: false,
    });

    results.push(resultItem);
    creditsConsumed++;
  }

  // Write usage ledger
  const usageRecords = results
    .filter((r: any) => !r.cached)
    .map((r: any) => ({
      user_id: keyData.user_id,
      api_key_id: keyData.id,
      api_key: apiKey.slice(0, 8) + "...",
      endpoint: "email/batch-check",
      cost_units: 1,
      request_cost: 0.001,
      ip_address: ip,
      plan: planKey,
    }));

  if (usageRecords.length > 0) {
    await supabaseAdmin.from("usage_ledger").insert(usageRecords);
    await supabaseAdmin
      .from("profiles")
      .update({ credits_remaining: Math.max(0, (profile.credits_remaining || 0) - creditsConsumed) })
      .eq("id", keyData.user_id);
  }

  // Write scan_history (async)
  supabaseAdmin.from("scan_history").insert(
    results.map((r: any) => ({
      user_id: keyData.user_id,
      scan_type: "email",
      target: r.email,
      risk_score: r.risk_score,
      success: true,
    }))
  ).then(() => {}, () => {});

  return NextResponse.json({
    success: true,
    batch_size: batchSize,
    results,
    cached_count: results.filter((r: any) => r.cached).length,
    new_checks: creditsConsumed,
    quota: {
      monthly_used: monthlyUsed + creditsConsumed,
      monthly_limit: limits.monthlyUnits,
      daily_used: dailyUsed + creditsConsumed,
      daily_limit: limits.dailyUnits,
    },
  });
}
