import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiKey, getMonthlyLimit } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const { valid, userId, apiKeyId, plan, monthlyUsed, error } = await validateApiKey(apiKey);
  if (!valid || !userId || !apiKeyId) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const monthlyLimit = await getMonthlyLimit(plan);
  if ((monthlyUsed || 0) >= monthlyLimit) {
    return NextResponse.json(
      { error: "Monthly limit exceeded. Upgrade your plan." },
      { status: 429 }
    );
  }

  let body: { ip?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ip = body.ip?.trim();
  if (!ip) {
    return NextResponse.json({ error: "IP is required" }, { status: 400 });
  }

  // Basic IP analysis
  const isPrivate =
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("192.168.") ||
    ip === "127.0.0.1";
  const isLocalhost = ip === "127.0.0.1" || ip === "::1";

  let riskScore = 0;
  if (isLocalhost) riskScore += 10;
  if (isPrivate) riskScore += 5;

  const result = {
    success: true,
    ip,
    is_private: isPrivate,
    is_localhost: isLocalhost,
    risk_score: riskScore,
  };

  const today = new Date().toISOString().split("T")[0];
  await Promise.all([
    supabaseAdmin.from("checks").insert({
      user_id: userId,
      check_type: "ip",
      input_value: ip,
      risk_score: riskScore,
      result_json: result,
    }),
    supabaseAdmin.rpc("increment_api_usage", {
      p_user_id: userId,
      p_api_key_id: apiKeyId,
      p_endpoint: "ip/check",
      p_date: today,
    }),
  ]);

  return NextResponse.json(result);
}
