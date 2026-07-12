import { createClient } from "@supabase/supabase-js";
import { getPlanLimits, hasApiAccess } from "@/lib/plans";

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

export async function validateApiKey(apiKey: string) {
  const { data: keyData, error: keyError } = await getSupabaseAdmin()
    .from("api_keys").select("id, user_id, status").eq("key", apiKey).eq("status", "active").single();
  if (keyError || !keyData) return { valid: false, error: "Invalid or revoked API key" };

  const { data: profile } = await getSupabaseAdmin().from("profiles").select("plan").eq("id", keyData.user_id).single();
  if (!profile) return { valid: false, error: "User not found" };

  const today = new Date().toISOString().split("T")[0];
  const { data: todayUsage } = await getSupabaseAdmin().from("api_usage").select("request_count").eq("user_id", keyData.user_id).eq("date", today);
  const todayUsed = todayUsage?.reduce((sum: any, r: any) => sum + r.request_count, 0) ?? 0;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const { data: monthUsage } = await getSupabaseAdmin().from("api_usage").select("request_count").eq("user_id", keyData.user_id).gte("date", startOfMonth);
  const monthlyUsed = monthUsage?.reduce((sum: any, r: any) => sum + r.request_count, 0) ?? 0;

  return { valid: true, userId: keyData.user_id, apiKeyId: keyData.id, plan: profile.plan, monthlyUsed, todayUsed };
}

export async function getMonthlyLimit(plan: string): Promise<number> {
  return getPlanLimits(plan).monthlyLimit;
}

export async function getDailyLimit(plan: string): Promise<number> {
  return getPlanLimits(plan).dailyLimit;
}

export async function getMaxTokens(plan: string): Promise<number> {
  return getPlanLimits(plan).maxTokensPerRequest;
}

export function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "fsk_";
  for (let i = 0; i < 32; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}


export async function validateAndCheckLimits(apiKey: string) {
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) return auth;

  if (!hasApiAccess(auth.plan)) {
    return { valid: false, error: "API access starts on Growth. Upgrade to unlock API." };
  }

  const monthlyLimit = await getMonthlyLimit(auth.plan);
  if ((auth.monthlyUsed || 0) >= monthlyLimit) {
    return { valid: false, error: "Monthly limit exceeded. Upgrade your plan." };
  }

  const dailyLimit = await getDailyLimit(auth.plan);
  if ((auth.todayUsed || 0) >= dailyLimit) {
    return { valid: false, error: "Daily limit reached. Try again tomorrow." };
  }

  return auth;
}
