import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateRiskScore, getAIExplanation, checkDomainAge, getDNSHealthScore, calculateCompanyHealth, getCachedResult, setCachedResult, makeResultCacheKey, cleanEmail } from "@/lib/risk-engine";

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

async function getUserFromRequest(request: NextRequest) {
  try {
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_6pS7tKkxxBqYTLcAUu_GPg_0BysHHx8"),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll().map(c => ({ name: c.name, value: c.value }));
          },
          setAll() {},
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

function buildResponseData(email: string | null, requestIP: string | null, riskResult: any, aiReason: string | null, domainAge: any, dnsHealth: any, companyHealth: any, newCredits: number, creditSuccess: boolean, cached: boolean) {
  return {
    input: email || requestIP || "",
    type: email ? "email" : "ip",
    risk_score: riskResult.score,
    decision: riskResult.decision,
    reasons: riskResult.reasons,
    impact: riskResult.impact || [],
    solution: riskResult.solution || [],
    domain_age: domainAge,
    dns_health: dnsHealth,
    company_health: companyHealth,
    details: {
      email: riskResult.emailDetails,
      ip: riskResult.ipDetails,
    },
    ai_explanation: aiReason || null,
    risk_factors: riskResult.risk_factors || [],
    recommendation: riskResult.recommendation || '',
    estimated_waste_cost: riskResult.estimated_waste_cost ?? 0,
    credits: { remaining: newCredits, success: creditSuccess },
    cached,
  };
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Please log in to use the risk checker." }, { status: 401 });
  }

  // Fetch profile with credits
  const { data: profile } = await getSupabaseAdmin()
    .from("profiles")
    .select("plan, credits_remaining, total_checks, risk_settings")
    .eq("id", user.id)
    .single();
  
  const plan = profile?.plan || "free";
  const creditsRemaining = profile?.credits_remaining ?? 0;
  const totalChecks = profile?.total_checks ?? 0;

  console.log("[RiskCheck]", user.id, "plan:", plan, "credits_before:", creditsRemaining, "total:", totalChecks);

  if (creditsRemaining <= 0) {
    return NextResponse.json({
      error: "NO_CREDITS",
      message: "You have 0 credits remaining. Upgrade to continue.",
      upgradeNeeded: true,
    }, { status: 429 });
  }

  let body: { email?: string; ip?: string } = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawEmail = body.email?.trim() || null;
  const email = cleanEmail(rawEmail); // input firewall: rejects empty, headers, spaces, invalid format
  const requestIP = body.ip?.trim() || null;

  if (!email && !requestIP) {
    if (rawEmail && !email) {
      return NextResponse.json({ error: "Invalid email format. Please enter a valid email address like user@example.com." }, { status: 400 });
    }
    return NextResponse.json({ error: "Please provide an email or IP address." }, { status: 400 });
  }

  // === STEP 0: Check result cache (24h TTL) ?hit returns instantly, NO credit consumed ===
  const cacheKey = makeResultCacheKey(email, requestIP);
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    console.log("[RiskCheck] cache HIT for", cacheKey, "?no credit deducted");
    return NextResponse.json({
      ...cachedResult,
      cached: true,
      credits: { remaining: creditsRemaining, success: true },
    });
  }

  // === STEP 1: Consume credit BEFORE running risk check ===
  const { data: creditResult, error: creditError } = await getSupabaseAdmin().rpc("consume_credit", {
    p_user_id: user.id,
  });
  if (creditError) {
    console.error("[RiskCheck] consume_credit RPC error:", creditError);
    return NextResponse.json({ error: "Failed to process credit. Please try again." }, { status: 500 });
  }

  const creditSuccess = creditResult?.success ?? false;
  const newCredits = creditResult?.credits_remaining ?? (creditsRemaining - 1);

  console.log("[RiskCheck] credit consumed, remaining:", newCredits);

  if (!creditSuccess) {
    return NextResponse.json({
      error: "NO_CREDITS",
      message: "Insufficient credits.",
      upgradeNeeded: true,
    }, { status: 429 });
  }
// === STEP 2: Run the actual risk check ===
  // Compute domain age before risk check (for core scoring)
  let domainAgeDays: number | null = null;
  if (email) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain) {
      try { const age = await checkDomainAge(domain); domainAgeDays = age.ageDays; } catch { /* skip */ }
    }
  }
  const riskResult = await calculateRiskScore({ email, ip: requestIP, domainAgeDays });
  const aiReason = await getAIExplanation(email, requestIP, riskResult.score, riskResult.reasons);

  // Domain extraction for Company Health Score
  let companyHealth = null;
  let domainAge = null;
  let dnsHealth = null;
  if (email) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain) {
      try {
        const [ageResult, dnsResult] = await Promise.all([
          checkDomainAge(domain),
          getDNSHealthScore(domain),
        ]);
        domainAge = ageResult;
        dnsHealth = dnsResult;
        companyHealth = await calculateCompanyHealth({
          riskScore: riskResult.score,
          isDisposable: !!riskResult.emailDetails?.isDisposable,
          hasMX: !!riskResult.emailDetails?.hasMX,
          hasSPF: !!riskResult.emailDetails?.hasSPF,
          hasDMARC: !!riskResult.emailDetails?.hasDMARC,
          dmarcPolicy: (riskResult.emailDetails?.dmarcPolicy as string) || "none",
          domainAgeDays: ageResult.ageDays,
          isProxy: !!riskResult.ipDetails?.isProxy,
          isHosting: !!riskResult.ipDetails?.isHosting,
          blacklistHits: riskResult.blacklistHits || [],
          country: (riskResult.ipDetails?.countryCode as string) || null,
        });
      } catch { /* non-critical */ }
    }
  }

  // === STEP 3: Cache the result for 24h (prevents re-consumption on duplicate queries) ===
  const cacheData = {
    input: email || requestIP || "",
    type: email ? "email" : "ip",
    risk_score: riskResult.score,
    decision: riskResult.decision,
    reasons: riskResult.reasons,
    impact: riskResult.impact || [],
    solution: riskResult.solution || [],
    domain_age: domainAge,
    dns_health: dnsHealth,
    company_health: companyHealth,
    details: {
      email: riskResult.emailDetails,
      ip: riskResult.ipDetails,
    },
    ai_explanation: aiReason || null,
    risk_factors: riskResult.risk_factors || [],
    recommendation: riskResult.recommendation || '',
    estimated_waste_cost: riskResult.estimated_waste_cost ?? 0,
    cached: false,
  };
  // Apply Protection Settings toggles
  const riskSettings = profile?.risk_settings as Record<string, boolean> | null;
  if (riskSettings) {
    const emailDetails = riskResult.emailDetails as Record<string, unknown> | null;
    if (riskSettings.block_disposable && emailDetails?.isDisposable) cacheData.decision = "BLOCK";
    if (riskSettings.block_high_risk && riskResult.score >= 60) cacheData.decision = "BLOCK";
    if (riskSettings.review_catch_all && emailDetails?.isCatchAll && cacheData.decision === "ALLOW") cacheData.decision = "REVIEW";
    if (riskSettings.review_new_domain && (cacheData as any).domain_age?.isNew && cacheData.decision === "ALLOW") cacheData.decision = "REVIEW";
  }
  setCachedResult(cacheKey, cacheData);
  console.log("[RiskCheck] cached result for", cacheKey, "(24h TTL)");

  // === STEP 4: Write to scan_history and checks (audit log, non-blocking) ===
  getSupabaseAdmin().from("scan_history").insert({
    user_id: user.id,
    scan_type: email ? "email" : "ip",
    target: email || requestIP || "unknown",
    risk_score: riskResult.score,
    success: true,
  }).then(() => {}, () => {});

  getSupabaseAdmin().from("checks").insert({
    user_id: user.id,
    check_type: email ? "email" : "ip",
    input_value: email || requestIP || "",
    risk_score: riskResult.score,
    result_json: cacheData,
  }).then(() => {}, () => {});

  // === STEP 5: Return result with credit info ===
  return NextResponse.json({
    ...cacheData,
    credits: { remaining: newCredits, success: creditSuccess },
  });
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ history: [] }, { status: 200 });
  }

  const { data: checks } = await getSupabaseAdmin()
    .from("checks")
    .select("id, check_type, input_value, risk_score, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ history: checks || [] });
}
