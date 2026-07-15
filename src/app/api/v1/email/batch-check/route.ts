import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateRiskScore, getAIExplanation, getCachedResult, setCachedResult, makeResultCacheKey, checkDomainAge, getDNSHealthScore, calculateCompanyHealth } from "@/lib/risk-engine";
import { getBatchExportColumnsForPlan, getPlanLimits, getResultCacheScope, sanitizeBatchResultForPlan, shouldUseAiExplanation, shouldUseDeepDetection, type PlanKey } from "@/lib/plans";
import { planCostLimits } from "@/lib/cost-control";
import { buildContactAuditDecision, buildListAuditSummary } from "@/lib/list-audit";
import { consumeLegacyCredits, getUniqueBillableEmails } from "@/lib/legacy-credits";
import { buildCreditRequestId } from "@/lib/credit-accounting";
import { reconcileInputRows } from "@/lib/decision-integrity";

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

const MAX_BATCH_SIZE = 100;

function attachAuditFields(displayRecord: Record<string, unknown>, sourceRecord: Record<string, unknown>) {
  const auditDecision = buildContactAuditDecision(sourceRecord);
  return {
    record: {
      ...displayRecord,
      decision: auditDecision.decision,
      risk_level: auditDecision.decision,
      audit_queue: auditDecision.queue,
      reason_codes: auditDecision.reasonCodes,
      primary_reason: auditDecision.primaryReason,
      recommended_action: auditDecision.recommendedAction,
      business_impact: auditDecision.businessImpact,
      confidence: auditDecision.confidence,
      evidence: auditDecision.evidence,
      decision_explanation: auditDecision.decisionExplanation,
    },
    auditDecision,
  };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
  // Accept API key from X-API-Key header, Authorization Bearer, or body.api_key
  let apiKey = req.headers.get("x-api-key") || "";
  if (!apiKey) {
    const authHeader = req.headers.get("authorization") || "";
    apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  }

  // Validate API key
  const { data: keyRows, error: keyError } = await getSupabaseAdmin()
    .from("api_keys")
    .select("id, user_id, status")
    .eq("key", apiKey)
    .eq("status", "active")
    .limit(1);

  if (keyError || !keyRows || keyRows.length === 0) {
    return NextResponse.json({ error: "INVALID_API_KEY", message: "Invalid or revoked API key" }, { status: 401 });
  }
  
  const keyData = keyRows[0];

  // Get profile & plan limits
  const { data: profile } = await getSupabaseAdmin()
    .from("profiles")
    .select("plan, credits_remaining, subscription_status")
    .eq("id", keyData.user_id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 401 });
  }

  const planKey = (profile.plan || "free") as PlanKey;
  const planInfo = getPlanLimits(planKey);
  const limits = planCostLimits[planKey] || planCostLimits.free;

  if (!planInfo.apiAccess) {
    return NextResponse.json({
      error: "API_ACCESS_REQUIRED",
      message: "API access starts on Growth. Upgrade to unlock automation and batch API.",
    }, { status: 403 });
  }

  // Parse body
  let body: { emails?: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emails = body.emails;
  if (!emails || !Array.isArray(emails)) {
    return NextResponse.json({ error: "emails array is required" }, { status: 400 });
  }
  if (emails.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: "Batch too large", message: "Max " + MAX_BATCH_SIZE + " emails per batch" }, { status: 400 });
  }

  // Filter valid emails
  // If API key still empty, try body
  if (!apiKey && (body as any).api_key) {
    apiKey = (body as any).api_key;
  }

  const rawCount = emails.length;
  const inputReconciliation = reconcileInputRows(emails.map(String));
  const validEmails = getUniqueBillableEmails(inputReconciliation.accepted);
  const skippedCount = rawCount - validEmails.length;
  if (validEmails.length === 0) {
    return NextResponse.json({
      error: "NO_VALID_EMAILS",
      message: "No valid email addresses found in the input. Skipped " + rawCount + " row(s). Ensure each row contains a proper email like user@example.com.",
      skipped: rawCount,
    }, { status: 400 });
  }

  const batchSize = validEmails.length;

  // Check quotas
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const { data: monthLedger } = await getSupabaseAdmin()
    .from("usage_ledger")
    .select("cost_units")
    .eq("user_id", keyData.user_id)
    .gte("created_at", startOfMonth);

  const monthlyUsed = (monthLedger || []).reduce((sum: number, r: any) => sum + (r.cost_units || 0), 0);
  if (monthlyUsed + batchSize > limits.monthlyUnits) {
    return NextResponse.json({
      error: "QUOTA_EXCEEDED",
      message: "Monthly quota exceeded. Remaining: " + Math.max(0, limits.monthlyUnits - monthlyUsed),
      monthly_remaining: Math.max(0, limits.monthlyUnits - monthlyUsed),
    }, { status: 429 });
  }

  const { data: dayLedger } = await getSupabaseAdmin()
    .from("usage_ledger")
    .select("cost_units")
    .eq("user_id", keyData.user_id)
    .gte("created_at", today);

  const dailyUsed = (dayLedger || []).reduce((sum: number, r: any) => sum + (r.cost_units || 0), 0);
  if (dailyUsed + batchSize > limits.dailyUnits) {
    return NextResponse.json({
      error: "QUOTA_EXCEEDED",
      message: "Daily quota exceeded. Remaining: " + Math.max(0, limits.dailyUnits - dailyUsed),
      daily_remaining: Math.max(0, limits.dailyUnits - dailyUsed),
    }, { status: 429 });
  }

  // Only charge after all non-credit quota checks have accepted the request.
  const legacyCreditResult = await consumeLegacyCredits({
    supabase: getSupabaseAdmin(),
    userId: keyData.user_id,
    requiredCredits: batchSize,
    requestId: buildCreditRequestId(req, "email-batch"),
    reason: req.headers.has("x-api-key") ? "sheets_audit" : "api_audit",
    requestFingerprint: { emails: validEmails },
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

  // Process emails in parallel with concurrency control (avoids 504 timeout on Vercel)
  const results: any[] = [];
  const auditDecisions: Array<ReturnType<typeof buildContactAuditDecision>> = [];
  const CONCURRENCY = 25;
  const startedAt = Date.now();
  let cacheHits = 0;
  let cacheMisses = 0;
  let reusedDomainChecks = 0;
  let aiExplanationMs = 0;
  const uniqueDomains = new Set<string>();
  const domainAgeByDomain = new Map<string, Promise<Awaited<ReturnType<typeof checkDomainAge>> | null>>();
  const dnsHealthByDomain = new Map<string, Promise<Awaited<ReturnType<typeof getDNSHealthScore>> | null>>();

  function getSharedDomainAge(domain: string) {
    const existing = domainAgeByDomain.get(domain);
    if (existing) {
      reusedDomainChecks++;
      return existing;
    }
    const promise = checkDomainAge(domain).catch(() => null);
    domainAgeByDomain.set(domain, promise);
    return promise;
  }

  function getSharedDNSHealth(domain: string) {
    const existing = dnsHealthByDomain.get(domain);
    if (existing) {
      reusedDomainChecks++;
      return existing;
    }
    const promise = getDNSHealthScore(domain).catch(() => null);
    dnsHealthByDomain.set(domain, promise);
    return promise;
  }

  async function processOneEmail(email: string): Promise<any> {
    const cacheKey = makeResultCacheKey(email, null) + ":" + getResultCacheScope(planKey);
    const cached = getCachedResult(cacheKey);
    if (cached) {
      cacheHits++;
      const sanitized = sanitizeBatchResultForPlan({ ...cached, cached: true }, planKey);
      const { record, auditDecision } = attachAuditFields(sanitized, cached);
      auditDecisions.push(auditDecision);
      return record;
    }
    cacheMisses++;

    const useDeepDetection = shouldUseDeepDetection(planKey);
    const domain = email.split("@")[1]?.toLowerCase() || null;
    if (domain) uniqueDomains.add(domain);
    const domainAge = (domain && useDeepDetection) ? await getSharedDomainAge(domain) : null;
    const riskResult = await calculateRiskScore({
      email,
      shouldCheckMX: true,
      domainAgeDays: useDeepDetection ? (domainAge?.ageDays ?? null) : null,
    });
    const dnsHealth = (domain && useDeepDetection && domainAge) ? await getSharedDNSHealth(domain) : null;
    const companyHealth = (domain && domainAge && useDeepDetection)
      ? await calculateCompanyHealth({
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
        }).catch(() => null)
      : null;
    const rawResult = {
      email,
      risk_score: riskResult.score,
      risk_level: riskResult.decision,
      reasons: riskResult.reasons,
      details: riskResult.emailDetails,
      ai_explanation: null as Awaited<ReturnType<typeof getAIExplanation>> | null,
      domain_age: domainAge,
      dns_health: dnsHealth,
      company_health: companyHealth,
      impact: riskResult.impact || [],
      solution: riskResult.solution || [],
      risk_factors: riskResult.risk_factors || [],
      recommendation: riskResult.recommendation || "",
      estimated_waste_cost: riskResult.estimated_waste_cost ?? 0,
      cached: false,
    };
    if (shouldUseAiExplanation(planKey)) {
      const aiStartedAt = Date.now();
      rawResult.ai_explanation = await getAIExplanation(email, null, riskResult.score, riskResult.reasons, planKey);
      aiExplanationMs += Date.now() - aiStartedAt;
    }
    setCachedResult(cacheKey, rawResult);
    const sanitized = sanitizeBatchResultForPlan(rawResult, planKey);
    const { record, auditDecision } = attachAuditFields(sanitized, rawResult);
    auditDecisions.push(auditDecision);
    return record;
  }

  // Process in concurrent chunks of CONCURRENCY
  for (let i = 0; i < validEmails.length; i += CONCURRENCY) {
    const chunk = validEmails.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(processOneEmail));
    for (const r of chunkResults) { results.push(r); }
  }

  // Write usage ledger as API analytics only. Credits were deducted once through consume_credit above.
  const usageRecords = results
    .map((r: any) => ({
      user_id: keyData.user_id,
      api_key_id: keyData.id,
      api_key: apiKey.slice(0, 8) + "...",
      endpoint: "email/batch-check",
      cost_units: 1,
      request_cost: 0.001,
      ip_address: ip,
      plan: planKey,
    }));

  if (usageRecords.length > 0) {
    await getSupabaseAdmin().from("usage_ledger").insert(usageRecords);
  }

  // Record each charged result before returning so dashboard totals cannot silently lag.
  const { error: scanHistoryError } = await getSupabaseAdmin().from("scan_history").insert(
    results.map((r: any) => ({
      user_id: keyData.user_id,
      scan_type: "email",
      target: r.email,
      risk_score: r.risk_score,
      success: true,
    })),
  );
  if (scanHistoryError) {
    console.error("[api-v1-email-batch-check] failed to record scan history", scanHistoryError.message);
  }

  // P2-8: Summary - decouple from subjective classification, only show objective stats
  // P2-9: Batch cost summary by risk level
  const allowCount = results.filter((r: any) => r.risk_level === "ALLOW").length;
  const reviewCount = results.filter((r: any) => r.risk_level === "REVIEW").length;
  const blockCount = results.filter((r: any) => r.risk_level === "BLOCK").length;
  const totalWasteCost = results.reduce((sum: number, r: any) => sum + (r.estimated_waste_cost || 0), 0);
  const auditSummary = buildListAuditSummary(auditDecisions);
  console.info("[api-v1-email-batch-check] performance", {
    total: results.length,
    durationMs: Date.now() - startedAt,
    cacheHits,
    cacheMisses,
    uniqueDomains: uniqueDomains.size,
    reusedDomainChecks,
    aiExplanationMs,
    plan: planKey,
  });

  return NextResponse.json({
    success: true,
    plan: planKey,
    batch_size: batchSize,
    detail_tier: getResultCacheScope(planKey),
    export_columns: getBatchExportColumnsForPlan(planKey),
    results,
    cached_count: results.filter((r: any) => r.cached).length,
    new_checks: legacyCreditResult.deducted,
    credits: {
      deducted: legacyCreditResult.deducted,
      requiredCredits: legacyCreditResult.requiredCredits,
      creditsAvailable: legacyCreditResult.creditsAvailable,
      remaining: legacyCreditResult.creditsRemaining,
    },
    input_reconciliation: {
      ...inputReconciliation,
      resultsProduced: results.length,
      creditsConsumed: legacyCreditResult.deducted,
    },
    summary: {
      total: batchSize,
      allow: allowCount,
      review: reviewCount,
      block: blockCount,
      allow_pct: batchSize > 0 ? Math.round((allowCount / batchSize) * 100) : 0,
      review_pct: batchSize > 0 ? Math.round((reviewCount / batchSize) * 100) : 0,
      block_pct: batchSize > 0 ? Math.round((blockCount / batchSize) * 100) : 0,
      estimated_waste_pct: blockCount > 0 ? Math.round((blockCount / batchSize) * 100) : 0,
      estimated_waste_cost_total: Math.round(totalWasteCost * 100) / 100,
      estimated_savings: Math.round(blockCount * 0.01 * 100) / 100,
    },
    audit_summary: auditSummary,
    quota: {
      monthly_used: monthlyUsed + legacyCreditResult.deducted,
      monthly_limit: limits.monthlyUnits,
      daily_used: dailyUsed + legacyCreditResult.deducted,
      daily_limit: limits.dailyUnits,
    },
  });
}


