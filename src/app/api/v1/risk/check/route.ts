import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { validateApiKey, getMonthlyLimit } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const disposableDomains = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "throwaway.email", "yopmail.com", "sharklasers.com", "trashmail.com",
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

  let body: { email?: string; ip?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const ip = body.ip?.trim();

  if (!email && !ip) {
    return NextResponse.json({ error: "At least one of email or ip is required" }, { status: 400 });
  }

  let riskScore = 0;
  const reasons: string[] = [];

  if (email) {
    const domain = email.split("@")[1] || "";
    const validFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!validFormat) { riskScore += 30; reasons.push("Invalid email format"); }
    if (disposableDomains.has(domain)) { riskScore += 30; reasons.push("Disposable email detected"); }
    if (domain.length < 3) { riskScore += 15; reasons.push("Suspicious domain"); }
  }

  if (ip) {
    if (ip === "127.0.0.1" || ip === "::1") { riskScore += 10; reasons.push("Localhost IP"); }
    if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.16.")) {
      riskScore += 5; reasons.push("Private network IP");
    }
  }

  riskScore = Math.min(riskScore, 100);

  let aiReason = "";
  let recommendation = riskScore >= 60 ? "BLOCK" : riskScore >= 30 ? "REVIEW" : "ALLOW";

  try {
    const userMsg = "Email: " + (email || "N/A") + ", IP: " + (ip || "N/A") + ", Risk score: " + riskScore + ", Reasons: " + (reasons.join(", ") || "none");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a fraud detection AI for SaaS platforms. Given an email and/or IP, explain in one short Chinese sentence why this user might be risky, based on the detected reasons. Be concise.",
        },
        { role: "user", content: userMsg },
      ],
      max_tokens: 80,
      temperature: 0.3,
    });
    aiReason = completion.choices[0]?.message?.content?.trim() || "";
  } catch {
    aiReason = reasons.join("; ") || "No suspicious signals detected";
  }

  const result = {
    success: true,
    risk_score: riskScore,
    decision: recommendation,
    reasons,
    ai_reason: aiReason,
    email: email || null,
    ip: ip || null,
  };

  const today = new Date().toISOString().split("T")[0];
  await Promise.all([
    supabaseAdmin.from("checks").insert({
      user_id: userId,
      check_type: "risk",
      input_value: JSON.stringify({ email, ip }),
      risk_score: riskScore,
      result_json: result,
    }),
    supabaseAdmin.rpc("increment_api_usage", {
      p_user_id: userId,
      p_api_key_id: apiKeyId,
      p_endpoint: "risk/check",
      p_date: today,
    }),
  ]);

  return NextResponse.json(result);
}
