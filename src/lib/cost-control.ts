import { createClient } from "@supabase/supabase-js";
import { getPlanLimits, hasApiAccess, plans } from "@/lib/plans";
import { hasActiveSubscriptionAccess } from "@/lib/creem";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SECRET_KEY || "");
let _supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = NEXT_PUBLIC_SUPABASE_URL;
    const key = SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _supabaseAdmin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    }
  }
  return _supabaseAdmin;
}

// ============ COST UNITS PER ENDPOINT ============

export const endpointCosts: Record<string, number> = {
  "email/check": 1,
  "ip/check": 2,
  "risk/check": 3,
  "pre-send/check": 5, // batch -- higher cost
};

export function getEndpointCost(endpoint: string): number {
  // Match the base endpoint
  for (const [key, cost] of Object.entries(endpointCosts)) {
    if (endpoint.includes(key)) return cost;
  }
  return 1; // default
}

// ============ PLAN COST UNIT LIMITS ============

export const planCostLimits: Record<string, { monthlyUnits: number; dailyUnits: number; perMinute: number }> =
  Object.fromEntries(
    Object.entries(plans).map(([key, plan]) => [
      key,
      {
        monthlyUnits: plan.monthlyLimit,
        dailyUnits: plan.dailyLimit,
        perMinute: plan.perMinuteLimit,
      },
    ])
  );

// ============ MIDDLEWARE: 7-STEP VALIDATION ============

export interface CostCheckResult {
  allowed: boolean;
  errorCode?: "QUOTA_EXCEEDED" | "RATE_LIMITED" | "IP_BLOCKED" | "SUBSCRIPTION_INACTIVE" | "ABUSE_DETECTED";
  errorMessage?: string;
  // Metrics for response
  costUnits: number;
  monthlyRemaining: number;
  dailyRemaining: number;
  perMinuteRemaining: number;
  ipRemaining: number;
  userId?: string;
  apiKeyId?: string;
  plan?: string;
}

export async function costControlCheck(params: {
  apiKey: string;
  endpoint: string;
  ip: string;
}): Promise<CostCheckResult> {
  const { apiKey, endpoint, ip } = params;
  const costUnits = getEndpointCost(endpoint);

  // ---- Step 1: Validate API key ----
  const { data: keyData, error: keyError } = await getSupabaseAdmin()
    .from("api_keys")
    .select("id, user_id, status")
    .eq("key", apiKey)
    .eq("status", "active")
    .single();

  if (keyError || !keyData) {
    return { allowed: false, errorCode: "RATE_LIMITED", errorMessage: "Invalid or revoked API key", costUnits, monthlyRemaining: 0, dailyRemaining: 0, perMinuteRemaining: 0, ipRemaining: 0 };
  }

  // ---- Step 2: Check subscription status ----
  const { data: profile } = await getSupabaseAdmin()
    .from("profiles")
    .select("plan, subscription_status, subscription_end")
    .eq("id", keyData.user_id)
    .single();

  if (!profile) {
    return { allowed: false, errorCode: "SUBSCRIPTION_INACTIVE", errorMessage: "User not found", costUnits, monthlyRemaining: 0, dailyRemaining: 0, perMinuteRemaining: 0, ipRemaining: 0 };
  }

  if (profile.subscription_status === "cancelled" && !hasActiveSubscriptionAccess("cancelled", profile.subscription_end)) {
    profile.plan = "free";
  }
  if (profile.subscription_status === "past_due" || profile.subscription_status === "paused") {
    const errorMessage = profile.subscription_status === "paused"
      ? "Subscription is paused. Resume billing to restore access."
      : "Subscription past due. Please update payment method.";
    return { allowed: false, errorCode: "SUBSCRIPTION_INACTIVE", errorMessage, costUnits, monthlyRemaining: 0, dailyRemaining: 0, perMinuteRemaining: 0, ipRemaining: 0, userId: keyData.user_id, apiKeyId: keyData.id, plan: profile.plan };
  }

  const planKey = profile.plan || "free";
  const limits = planCostLimits[planKey] || planCostLimits.free;

  if (!hasApiAccess(planKey)) {
    return {
      allowed: false,
      errorCode: "SUBSCRIPTION_INACTIVE",
      errorMessage: "API access starts on Growth. Upgrade to unlock API.",
      costUnits,
      monthlyRemaining: 0,
      dailyRemaining: 0,
      perMinuteRemaining: 0,
      ipRemaining: 0,
      userId: keyData.user_id,
      apiKeyId: keyData.id,
      plan: planKey,
    };
  }

  // ---- Step 3: Check monthly cost unit quota ----
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const { data: monthLedger } = await getSupabaseAdmin()
    .from("usage_ledger")
    .select("cost_units")
    .eq("user_id", keyData.user_id)
    .gte("created_at", startOfMonth);

  const monthlyUsed = (monthLedger || []).reduce((sum: any, r: any) => sum + (r.cost_units || 0), 0);
  const monthlyRemaining = limits.monthlyUnits - monthlyUsed;

  if (monthlyRemaining <= 0) {
    return { allowed: false, errorCode: "QUOTA_EXCEEDED", errorMessage: `Monthly cost unit limit (${limits.monthlyUnits}) exceeded. Upgrade your plan.`, costUnits, monthlyRemaining: 0, dailyRemaining: 0, perMinuteRemaining: 0, ipRemaining: 0, userId: keyData.user_id, apiKeyId: keyData.id, plan: planKey };
  }

  // ---- Step 4: Check daily cost unit quota ----
  const today = now.toISOString().split("T")[0];
  const { data: dayLedger } = await getSupabaseAdmin()
    .from("usage_ledger")
    .select("cost_units")
    .eq("user_id", keyData.user_id)
    .gte("created_at", today);

  const dailyUsed = (dayLedger || []).reduce((sum: any, r: any) => sum + (r.cost_units || 0), 0);
  const dailyRemaining = limits.dailyUnits - dailyUsed;

  if (dailyRemaining <= 0) {
    return { allowed: false, errorCode: "QUOTA_EXCEEDED", errorMessage: `Daily cost unit limit (${limits.dailyUnits}) reached. Try again tomorrow.`, costUnits, monthlyRemaining, dailyRemaining: 0, perMinuteRemaining: 0, ipRemaining: 0, userId: keyData.user_id, apiKeyId: keyData.id, plan: planKey };
  }

  // ---- Step 5: Check per-minute rate limit ----
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const { data: minLedger } = await getSupabaseAdmin()
    .from("usage_ledger")
    .select("cost_units")
    .eq("user_id", keyData.user_id)
    .gte("created_at", oneMinuteAgo);

  const perMinuteUsed = (minLedger || []).reduce((sum: any, r: any) => sum + (r.cost_units || 0), 0);
  const perMinuteRemaining = limits.perMinute - perMinuteUsed;

  if (perMinuteRemaining <= 0) {
    return { allowed: false, errorCode: "RATE_LIMITED", errorMessage: `Per-minute rate limit (${limits.perMinute} units) exceeded. Slow down.`, costUnits, monthlyRemaining, dailyRemaining, perMinuteRemaining: 0, ipRemaining: 0, userId: keyData.user_id, apiKeyId: keyData.id, plan: planKey };
  }

  // ---- Step 6: Check IP rate limit ----
  const { data: ipRows } = await getSupabaseAdmin()
    .from("ip_requests")
    .select("request_count")
    .eq("ip_address", ip)
    .gte("window_start", oneMinuteAgo);

  const ipLimit = Math.max(getPlanLimits(planKey).ipPerMinuteLimit, limits.perMinute * 2);
  const ipUsed = (ipRows || []).reduce((sum: any, r: any) => sum + (r.request_count || 0), 0);
  const ipRemaining = ipLimit - ipUsed;

  if (ipRemaining <= 0) {
    return { allowed: false, errorCode: "IP_BLOCKED", errorMessage: "IP rate limit exceeded. Too many requests from this IP.", costUnits, monthlyRemaining, dailyRemaining, perMinuteRemaining, ipRemaining: 0, userId: keyData.user_id, apiKeyId: keyData.id, plan: planKey };
  }

  // ---- Step 7: Abuse detection (lightweight) ----
  const abuseResult = await detectAbuse(keyData.user_id, keyData.id, ip);
  if (abuseResult.blocked) {
    return { allowed: false, errorCode: "ABUSE_DETECTED", errorMessage: abuseResult.reason || "Abnormal usage pattern detected. Temporary block applied.", costUnits, monthlyRemaining, dailyRemaining, perMinuteRemaining, ipRemaining, userId: keyData.user_id, apiKeyId: keyData.id, plan: planKey };
  }

  // ---- All checks passed -- write usage ledger entry BEFORE response ----
  await getSupabaseAdmin().from("usage_ledger").insert({
    user_id: keyData.user_id,
    api_key_id: keyData.id,
    api_key: apiKey.slice(0, 8) + "...",
    endpoint,
    cost_units: costUnits,
    request_cost: costUnits * 0.001, // $0.001 per cost unit as baseline
    ip_address: ip,
    plan: planKey,
    created_at: now.toISOString(),
  });

  // Track IP request
  await getSupabaseAdmin().from("ip_requests").insert({
    ip_address: ip,
    api_key_id: keyData.id,
    user_id: keyData.user_id,
    endpoint,
    request_count: 1,
    window_start: now.toISOString(),
  });

  return {
    allowed: true,
    costUnits,
    monthlyRemaining,
    dailyRemaining,
    perMinuteRemaining,
    ipRemaining,
    userId: keyData.user_id,
    apiKeyId: keyData.id,
    plan: planKey,
  };
}

// ============ ABUSE DETECTION ============

interface AbuseResult {
  blocked: boolean;
  reason?: string;
  burstRatio?: number;
  multipleKeys?: boolean;
}

export async function detectAbuse(userId: string, apiKeyId: string, ip: string): Promise<AbuseResult> {
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Burst detection: compare last 10 minutes with baseline (avg of last 24h)
  const { data: recent } = await getSupabaseAdmin()
    .from("usage_ledger")
    .select("cost_units")
    .eq("user_id", userId)
    .gte("created_at", tenMinutesAgo);

  const recentUnits = (recent || []).reduce((sum: any, r: any) => sum + (r.cost_units || 0), 0);

  const { data: baseline } = await getSupabaseAdmin()
    .from("usage_ledger")
    .select("cost_units")
    .eq("user_id", userId)
    .gte("created_at", oneDayAgo);

  const baselineUnits = (baseline || []).reduce((sum: any, r: any) => sum + (r.cost_units || 0), 0);
  // Baseline per 10-minute window: total / 144 (24h = 144 x 10min)
  const avgPerTenMin = baselineUnits / 144 || 1;
  const burstRatio = avgPerTenMin > 0 ? recentUnits / avgPerTenMin : 1;

  // If recent usage > 5x the 10-minute average, flag as burst
  if (burstRatio > 5 && recentUnits > 20) {
    await logAbuseEvent(userId, apiKeyId, ip, "burst_detected", burstRatio);
    return { blocked: true, reason: "Usage spike detected -- temporary block (5 min)", burstRatio };
  }

  // 2. Same IP using multiple API keys
  const { data: ipKeys } = await getSupabaseAdmin()
    .from("usage_ledger")
    .select("api_key_id")
    .eq("ip_address", ip)
    .gte("created_at", oneHourAgo);

  const uniqueKeyCount = new Set((ipKeys || []).map((r: any) => r.api_key_id).filter(Boolean)).size;
  if (uniqueKeyCount > 3) {
    await logAbuseEvent(userId, apiKeyId, ip, "multiple_keys_per_ip", uniqueKeyCount);
    return { blocked: true, reason: "Multiple API keys from same IP", multipleKeys: true };
  }

  // 3. Check existing abuse_events -- if already temporarily blocked
  const { data: recentBlocks } = await getSupabaseAdmin()
    .from("abuse_events")
    .select("created_at")
    .eq("user_id", userId)
    .eq("action", "temporary_block")
    .gte("created_at", tenMinutesAgo);

  if (recentBlocks && recentBlocks.length > 3) {
    // Extend block to 30 minutes
    return { blocked: true, reason: "Repeated abuse -- extended block (30 min)" };
  }

  return { blocked: false };
}

async function logAbuseEvent(userId: string, apiKeyId: string, ip: string, eventType: string, metric: number) {
  await getSupabaseAdmin().from("abuse_events").insert({
    user_id: userId,
    api_key_id: apiKeyId,
    ip_address: ip,
    event_type: eventType,
    metric_value: metric,
    action: "temporary_block",
    created_at: new Date().toISOString(),
  });
}

// ============ COST ANALYTICS (for dashboard) ============

export async function getCostAnalytics(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const { data: monthData } = await getSupabaseAdmin()
    .from("usage_ledger")
    .select("cost_units, endpoint, created_at")
    .eq("user_id", userId)
    .gte("created_at", startOfMonth);

  const totalCost = (monthData || []).reduce((sum: any, r: any) => sum + (r.cost_units || 0) * 0.001, 0);

  // Group by endpoint
  const byEndpoint: Record<string, number> = {};
  for (const r of (monthData || [])) {
    const ep = r.endpoint || "unknown";
    byEndpoint[ep] = (byEndpoint[ep] || 0) + (r.cost_units || 0);
  }

  return {
    totalCostThisMonth: Math.round(totalCost * 1000) / 1000,
    totalUnitsThisMonth: (monthData || []).reduce((sum: any, r: any) => sum + (r.cost_units || 0), 0),
    byEndpoint,
    requestCount: (monthData || []).length,
  };
}

// ============ TOP EXPENSIVE USERS (admin only) ============

export async function getTopExpensiveUsers(limit = 10) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const { data } = await getSupabaseAdmin()
    .from("usage_ledger")
    .select("user_id, cost_units, endpoint")
    .gte("created_at", startOfMonth);

  // Aggregate by user
  const userCosts: Record<string, { units: number; cost: number; requests: number }> = {};
  for (const r of (data || [])) {
    if (!userCosts[r.user_id]) userCosts[r.user_id] = { units: 0, cost: 0, requests: 0 };
    userCosts[r.user_id].units += r.cost_units || 0;
    userCosts[r.user_id].cost += (r.cost_units || 0) * 0.001;
    userCosts[r.user_id].requests += 1;
  }

  return Object.entries(userCosts)
    .map(([userId, stats]) => ({ userId, ...stats, cost: Math.round(stats.cost * 1000) / 1000 }))
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);
}
