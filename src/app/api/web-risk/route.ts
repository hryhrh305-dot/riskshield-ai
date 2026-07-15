import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateRiskScore, getAIExplanation, checkDomainAge, calculateCompanyHealth, getCachedResult, setCachedResult, makeResultCacheKey, cleanEmail } from "@/lib/risk-engine";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";
import { getResultCacheScope, sanitizeSingleRiskPayloadForPlan, shouldUseAiExplanation, shouldUseDeepDetection } from "@/lib/plans";
import { consumeLegacyCredits } from "@/lib/legacy-credits";
import { buildCreditRequestId } from "@/lib/credit-accounting";
import { buildContactAuditDecision } from "@/lib/list-audit";

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

async function getUserFromRequest(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieHeader = request.headers.get("cookie") || "";
    const projectRef = "njhjiavnidssjvnkcxfo";
    const token = readAccessTokenFromCookieHeader(cookieHeader, projectRef);
    if (!token) return null;
    var { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (e) {
    console.error("[getUserFromRequest] error:", e);
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
    decision_explanation: riskResult.decision_explanation || riskResult.emailDetails?.decisionExplanation || null,
    risk_factors: riskResult.risk_factors || [],
    recommendation: riskResult.recommendation || '',
    estimated_waste_cost: riskResult.estimated_waste_cost ?? 0,
    credits: { remaining: newCredits, success: creditSuccess },
    cached,
  };
}

function buildDNSHealthFromEmailDetails(emailDetails: Record<string, unknown> | null) {
  if (!emailDetails) return null;
  const detailsSource = emailDetails as Record<string, any>;
  const mx = !!detailsSource.hasMX;
  const spf = !!detailsSource.hasSPF;
  const dmarc = !!detailsSource.hasDMARC;
  const dkim = !!detailsSource.hasDKIM;
  const dmarcPolicy = (detailsSource.dmarcPolicy as string) || "none";
  const details: string[] = [];
  let score = 0;
  if (mx && detailsSource.mxChecked) { score += 30; details.push("MX: OK"); }
  else if (detailsSource.mxChecked) { details.push("MX: MISSING"); }
  else { score += 10; details.push("MX: Unknown"); }
  if (spf && detailsSource.spfChecked) { score += 25; details.push("SPF: Present"); }
  else if (detailsSource.spfChecked) { details.push("SPF: Missing"); }
  if (dmarc && detailsSource.dmarcChecked) {
    score += 25;
    details.push("DMARC: Present (" + dmarcPolicy + ")");
    if (dmarcPolicy === "reject") score += 10;
  } else if (detailsSource.dmarcChecked) {
    details.push("DMARC: Missing");
  }
  if (dkim && detailsSource.dkimChecked) { score += 25; details.push("DKIM: Present (" + (detailsSource.dkimSelector || "unknown") + ")"); }
  else if (detailsSource.dkimChecked) { details.push("DKIM: Missing"); }
  if (mx && spf && dmarc && dkim) score += 10;
  return { score: Math.min(100, score), mx, spf, dmarc, dmarcPolicy, dkim, dkimSelector: (detailsSource.dkimSelector as string) || "", details };
}

export async function POST(request: NextRequest) {
try {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Please log in to use the risk checker." }, { status: 401 });
  }

  // Fetch profile with credits
  const { data: profile } = await getSupabaseAdmin()
    .from("profiles")
    .select("plan, credits_remaining, total_checks")
    .eq("id", user.id)
    .single();
  
  // Load risk_settings separately (column may not exist yet)
  let riskSettings: Record<string, boolean> | null = null;
  try {
    const { data: rs } = await getSupabaseAdmin()
      .from("profiles")
      .select("risk_settings")
      .eq("id", user.id)
      .single();
    if (rs?.risk_settings) riskSettings = rs.risk_settings as Record<string, boolean>;
  } catch { /* column may not exist yet, use defaults */ }

  const plan = profile?.plan || "free";
  const creditsRemaining = profile?.credits_remaining ?? 0;
  const totalChecks = profile?.total_checks ?? 0;

  console.log("[RiskCheck]", user.id, "plan:", plan, "credits_before:", creditsRemaining, "total:", totalChecks);

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

  // Charge once for every valid full audit result returned to the user.
  const legacyCreditResult = await consumeLegacyCredits({
    supabase: getSupabaseAdmin(),
    userId: user.id,
    requiredCredits: 1,
    requestId: buildCreditRequestId(request, "web-risk"),
    reason: "web_audit",
    requestFingerprint: { email, ip: requestIP },
  });

  if (!legacyCreditResult.ok) {
    const isInsufficient = legacyCreditResult.error === "INSUFFICIENT_CREDITS";
    return NextResponse.json({
      error: "Insufficient credits",
      message: isInsufficient
        ? "Insufficient credits."
        : "Failed to process credit. Please try again.",
      upgradeNeeded: isInsufficient,
      requiredCredits: legacyCreditResult.requiredCredits,
      creditsAvailable: legacyCreditResult.creditsAvailable,
    }, { status: isInsufficient ? 429 : 500 });
  }

  // === STEP 0: Check result cache (24h TTL). Full audit cache hits still consume one credit. ===
  const cacheKey = makeResultCacheKey(email, requestIP) + ":" + getResultCacheScope(plan);
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    console.log("[RiskCheck] cache HIT for", cacheKey, "credit deducted");
    const sanitizedCached = sanitizeSingleRiskPayloadForPlan(cachedResult, plan);
    const cachedAudit = email ? buildContactAuditDecision({ ...cachedResult, email }) : null;
    return NextResponse.json({
      ...sanitizedCached,
      ...(cachedAudit ? {
        decision: cachedAudit.decision,
        audit_queue: cachedAudit.queue,
        primary_reason: cachedAudit.primaryReason,
        recommended_action: cachedAudit.recommendedAction,
        confidence: cachedAudit.confidence,
        decision_explanation: cachedAudit.decisionExplanation,
      } : {}),
      cached: true,
      credits: {
        deducted: legacyCreditResult.deducted,
        requiredCredits: legacyCreditResult.requiredCredits,
        creditsAvailable: legacyCreditResult.creditsAvailable,
        remaining: legacyCreditResult.creditsRemaining,
        success: true,
      },
    });
  }
// === STEP 2: Run the actual risk check ===
  const useDeepDetection = shouldUseDeepDetection(plan);
  const domain = email ? email.split("@")[1]?.toLowerCase() : null;
  const domainAge = (domain && useDeepDetection) ? await checkDomainAge(domain).catch(() => null) : null;
  const domainAgeDays: number | null = domainAge?.ageDays ?? null;
  const riskResult = await calculateRiskScore({ email, ip: requestIP, domainAgeDays: useDeepDetection ? domainAgeDays : null });
  const aiReason = shouldUseAiExplanation(plan)
    ? await getAIExplanation(email, requestIP, riskResult.score, riskResult.reasons, plan)
    : null;

  // Domain extraction for Company Health Score
  let companyHealth = null;
  const dnsHealth = useDeepDetection ? buildDNSHealthFromEmailDetails(riskResult.emailDetails) : null;
  if (email && domainAge && useDeepDetection) {
    try {
      companyHealth = await calculateCompanyHealth({
        riskScore: riskResult.score,
        isDisposable: !!riskResult.emailDetails?.isDisposable,
        hasMX: !!riskResult.emailDetails?.hasMX,
        hasSPF: !!riskResult.emailDetails?.hasSPF,
        hasDMARC: !!riskResult.emailDetails?.hasDMARC,
        dmarcPolicy: (riskResult.emailDetails?.dmarcPolicy as string) || "none",
        domainAgeDays: domainAge.ageDays,
        isProxy: !!riskResult.ipDetails?.isProxy,
        isHosting: !!riskResult.ipDetails?.isHosting,
        blacklistHits: riskResult.blacklistHits || [],
        country: (riskResult.ipDetails?.countryCode as string) || null,
      });
    } catch { /* non-critical */ }
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
    decision_explanation: riskResult.decision_explanation || riskResult.emailDetails?.decisionExplanation || null,
    risk_factors: riskResult.risk_factors || [],
    recommendation: riskResult.recommendation || '',
    estimated_waste_cost: riskResult.estimated_waste_cost ?? 0,
    cached: false,
  };
  // Apply Protection Settings toggles
  if (riskSettings) {
    const emailDetails = riskResult.emailDetails as Record<string, unknown> | null;
    if (riskSettings.block_disposable && emailDetails?.isDisposable) cacheData.decision = "BLOCK";
    if (riskSettings.block_high_risk && riskResult.score >= 66) cacheData.decision = "BLOCK";
    if (riskSettings.review_catch_all && emailDetails?.isCatchAll && cacheData.decision === "ALLOW") cacheData.decision = "REVIEW";
    if (riskSettings.review_new_domain && (cacheData as any).domain_age?.isNew && cacheData.decision === "ALLOW") cacheData.decision = "REVIEW";
  }
  if (email) {
    const audit = buildContactAuditDecision({ ...cacheData, email });
    cacheData.decision = audit.decision;
    Object.assign(cacheData, {
      audit_queue: audit.queue,
      primary_reason: audit.primaryReason,
      recommended_action: audit.recommendedAction,
      confidence: audit.confidence,
      decision_explanation: audit.decisionExplanation,
    });
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
    ...sanitizeSingleRiskPayloadForPlan(cacheData, plan),
    credits: {
      deducted: legacyCreditResult.deducted,
      requiredCredits: legacyCreditResult.requiredCredits,
      creditsAvailable: legacyCreditResult.creditsAvailable,
      remaining: legacyCreditResult.creditsRemaining,
      success: true,
    },
  });
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[RiskCheck] UNCAUGHT:", msg);
  return NextResponse.json({ error: "INTERNAL", message: msg }, { status: 500 });
}
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
