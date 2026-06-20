import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function validateApiKey(apiKey: string) {
  // Find key
  const { data: keyData, error: keyError } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, status")
    .eq("key", apiKey)
    .eq("status", "active")
    .single();

  if (keyError || !keyData) {
    return { valid: false, error: "Invalid or revoked API key" };
  }

  // Check plan limits
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", keyData.user_id)
    .single();

  if (!profile) {
    return { valid: false, error: "User not found" };
  }

  // Count this month's usage
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const { data: usageRows } = await supabaseAdmin
    .from("api_usage")
    .select("request_count")
    .eq("user_id", keyData.user_id)
    .gte("date", startOfMonth);

  const monthlyUsed = usageRows?.reduce((sum, r) => sum + r.request_count, 0) ?? 0;

  return {
    valid: true,
    userId: keyData.user_id,
    apiKeyId: keyData.id,
    plan: profile.plan,
    monthlyUsed,
  };
}

export async function getMonthlyLimit(plan: string): Promise<number> {
  switch (plan) {
    case "starter": return 50_000;
    case "growth": return 200_000;
    case "business": return 1_000_000;
    case "free":
    default: return 1_000;
  }
}

export function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = "fsk_";
  let key = prefix;
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}
