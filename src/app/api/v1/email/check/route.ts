import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiKey, getMonthlyLimit } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const disposableDomains = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "throwaway.email", "yopmail.com", "sharklasers.com", "trashmail.com",
  "temp-mail.org", "fakeinbox.com", "guerrillamail.org", "guerrillamail.net",
]);

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

  let body: { email?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Check format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validFormat = emailRegex.test(email);

  const domain = email.split("@")[1] || "";
  const disposable = disposableDomains.has(domain);

  let riskScore = 0;
  if (!validFormat) riskScore += 50;
  if (disposable) riskScore += 40;
  if (domain.length < 3) riskScore += 20;
  riskScore = Math.min(riskScore, 100);

  const result = {
    success: true,
    email,
    valid: validFormat,
    disposable,
    domain,
    risk_score: riskScore,
  };

  // Save check record + increment usage
  const today = new Date().toISOString().split("T")[0];
  await Promise.all([
    supabaseAdmin.from("checks").insert({
      user_id: userId,
      check_type: "email",
      input_value: email,
      risk_score: riskScore,
      result_json: result,
    }),
    supabaseAdmin.rpc("increment_api_usage", {
      p_user_id: userId,
      p_api_key_id: apiKeyId,
      p_endpoint: "email/check",
      p_date: today,
    }),
  ]);

  return NextResponse.json(result);
}
