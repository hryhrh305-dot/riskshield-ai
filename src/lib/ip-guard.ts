import { createClient } from "@supabase/supabase-js";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const supabaseAdmin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ipRateLimits: Record<string, number> = {
  free: 30,
  starter: 100,
  growth: 300,
  business: 1000,
};

export interface IPGuardResult {
  allowed: boolean;
  ipRequestCount: number;
  limit: number;
  error?: string;
}

export async function checkIPRateLimit(
  ip: string,
  userId?: string,
  apiKeyId?: string,
  plan?: string,
  endpoint?: string
): Promise<IPGuardResult> {
  const effectivePlan = plan || "free";
  const limit = ipRateLimits[effectivePlan] || 30;
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

  const { data: rows } = await supabaseAdmin
    .from("ip_requests")
    .select("request_count")
    .eq("ip_address", ip)
    .gte("window_start", oneMinuteAgo);

  const totalRequests = (rows || []).reduce((sum, r) => sum + (r.request_count || 0), 0);

  if (totalRequests >= limit) {
    return { allowed: false, ipRequestCount: totalRequests, limit, error: "IP_RATE_LIMIT_EXCEEDED" };
  }

  await supabaseAdmin.from("ip_requests").insert({
    ip_address: ip,
    api_key_id: apiKeyId || null,
    user_id: userId || null,
    endpoint: endpoint || "api",
    request_count: 1,
    window_start: new Date().toISOString(),
  });

  return { allowed: true, ipRequestCount: totalRequests + 1, limit };
}

export async function detectAbusePatterns(ip: string): Promise<{
  multipleKeys: boolean;
  burstDetected: boolean;
  uniqueKeyCount: number;
}> {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { data: keyUsage } = await supabaseAdmin
    .from("ip_requests")
    .select("api_key_id")
    .eq("ip_address", ip)
    .gte("window_start", oneHourAgo);

  const uniqueKeys = new Set((keyUsage || []).map(r => r.api_key_id).filter(Boolean));

  const oneMinAgo = new Date(Date.now() - 60000).toISOString();
  const { data: burstData } = await supabaseAdmin
    .from("ip_requests")
    .select("request_count")
    .eq("ip_address", ip)
    .gte("window_start", oneMinAgo);

  const totalRecent = (burstData || []).reduce((s, r) => s + r.request_count, 0);

  return {
    multipleKeys: uniqueKeys.size > 3,
    burstDetected: totalRecent > 50,
    uniqueKeyCount: uniqueKeys.size,
  };
}
