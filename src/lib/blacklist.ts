import { createClient } from "@supabase/supabase-js";

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

const memoryCache = new Map<string, Record<string,unknown>>();
const CACHE_TTL = 300000;
let cacheLoaded = false;
let cacheLoadTime = 0;

async function loadCache(): Promise<void> {
  if (cacheLoaded && Date.now() - cacheLoadTime < CACHE_TTL) return;
  const { data } = await getSupabaseAdmin().from("blacklist").select("*").eq("status", "active");
  memoryCache.clear();
  for (const entry of data || []) {
    memoryCache.set(entry.type + ":" + entry.value, entry);
  }
  cacheLoaded = true;
  cacheLoadTime = Date.now();
}

export async function checkBlacklist(type: "ip" | "email" | "domain", value: string): Promise<Record<string,unknown> | null> {
  if (!cacheLoaded) await loadCache();
  const key = type + ":" + value;
  const cached = memoryCache.get(key);
  if (cached) {
    getSupabaseAdmin().from("blacklist").update({ hit_count: (Number(cached.hit_count) || 0) + 1, last_hit_at: new Date().toISOString() }).eq("type", type).eq("value", value).then(() => {});
    return cached;
  }
  const { data } = await getSupabaseAdmin().from("blacklist").select("*").eq("type", type).eq("value", value).eq("status", "active").single();
  if (data) {
    memoryCache.set(key, data);
    getSupabaseAdmin().from("blacklist").update({ hit_count: (data.hit_count || 0) + 1, last_hit_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
    return data;
  }
  return null;
}

export async function addToBlacklist(params: { type: "ip" | "email" | "domain"; value: string; reason?: string; risk_score?: number }): Promise<void> {
  const existing = await checkBlacklist(params.type, params.value);
  if (existing) {
    await getSupabaseAdmin().from("blacklist").update({
      hit_count: (Number(existing.hit_count) || 0) + 1,
      risk_score: Math.max(Number(existing.risk_score) || 0, params.risk_score || 0),
      last_hit_at: new Date().toISOString(),
      reason: params.reason || existing.reason,
    }).eq("type", params.type).eq("value", params.value);
  } else {
    await getSupabaseAdmin().from("blacklist").insert({
      type: params.type, value: params.value,
      reason: params.reason || "Auto-detected by RiskShield",
      risk_score: params.risk_score || 0, hit_count: 1, status: "active",
    });
  }
  memoryCache.set(params.type + ":" + params.value, {
    type: params.type, value: params.value,
    reason: params.reason || "Auto-detected",
    risk_score: params.risk_score || 0,
    hit_count: (existing ? Number(existing.hit_count) + 1 : 1),
  });
}

export async function autoBlacklistIfHighRisk(params: { type: "ip" | "email" | "domain"; value: string; risk_score: number; reasons: string[] }): Promise<void> {
  if (params.risk_score >= 85) {
    await addToBlacklist({ type: params.type, value: params.value, reason: params.reasons.join("; "), risk_score: params.risk_score });
  }
}

export async function cleanupExpired(): Promise<void> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  await getSupabaseAdmin().from("blacklist").update({ status: "released" }).eq("status", "active").lt("last_hit_at", ninetyDaysAgo);
}
