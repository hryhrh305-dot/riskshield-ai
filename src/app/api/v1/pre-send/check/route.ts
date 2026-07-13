import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { costControlCheck } from "@/lib/cost-control";
import { checkBlacklist, autoBlacklistIfHighRisk } from "@/lib/blacklist";
import { disposableDomainsSet } from "@/lib/disposable-domains";
import { buildContactAuditDecision, buildListAuditSummary } from "@/lib/list-audit";
import { consumeLegacyCredits } from "@/lib/legacy-credits";
import { buildCreditRequestId } from "@/lib/credit-accounting";
const disposableDomains = disposableDomainsSet;

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

const batchCache = new Map<string, { result: Record<string, unknown>; ts: number }>();
const BATCH_CACHE_TTL = 300000;

function attachAuditFields(displayRecord: Record<string, unknown>, sourceRecord: Record<string, unknown>) {
  const auditDecision = buildContactAuditDecision(sourceRecord);
  return {
    record: {
      ...displayRecord,
      audit_queue: auditDecision.queue,
      reason_codes: auditDecision.reasonCodes,
      primary_reason: auditDecision.primaryReason,
      recommended_action: auditDecision.recommendedAction,
      business_impact: auditDecision.businessImpact,
      confidence: auditDecision.confidence,
      evidence: auditDecision.evidence,
    },
    auditDecision,
  };
}

function quickEmailCheck(email: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const [lp, dl] = email.split("@");
  if (!lp || !dl) { score += 50; reasons.push("Invalid format"); return { score, reasons }; }
  if (disposableDomains.has(dl.toLowerCase())) { score += 45; reasons.push("Disposable email"); }
  if (/^\d+$/.test(lp)) { score += 12; reasons.push("Numeric local part"); }
  if ((lp.match(/\./g) || []).length > 3) { score += 8; reasons.push("Excessive dots"); }
  if (email.length > 50) { score += 5; reasons.push("Long email"); }
  if (dl.length < 4) { score += 15; reasons.push("Short domain"); }
  return { score: Math.min(score, 100), reasons };
}

export async function POST(req: NextRequest) {
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
  const apiKey = req.headers.get("authorization")?.replace("Bearer ", "") || "";

  let body: { emails?: string[]; ip?: string; campaign_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  // MAX BATCH SIZE: 1000 emails
  const emails = (body.emails || []).slice(0, 1000);
  const billableEmails = emails.map((email) => email.trim().toLowerCase()).filter(Boolean);
  const targetIP = body.ip?.trim() || null;
  if (!billableEmails.length) return NextResponse.json({ success: false, error: "emails array is required" }, { status: 400 });

  const cc = await costControlCheck({ apiKey, endpoint: "pre-send/check", ip: clientIP });
  if (!cc.allowed) {
    return NextResponse.json({ success: false, error: cc.errorCode, message: cc.errorMessage }, { status: 429 });
  }

  const legacyCreditResult = await consumeLegacyCredits({
    supabase: getSupabaseAdmin(),
    userId: cc.userId,
    requiredCredits: billableEmails.length,
    requestId: buildCreditRequestId(req, "pre-send"),
    reason: "pre_send_audit",
    requestFingerprint: { emails: billableEmails, ip: targetIP, campaignId: body.campaign_id ?? null },
  });
  if (!legacyCreditResult.ok) {
    const isInsufficient = legacyCreditResult.error === "INSUFFICIENT_CREDITS";
    return NextResponse.json({
      success: false,
      error: "Insufficient credits",
      message: isInsufficient ? "Insufficient credits." : "Failed to process credit. Please try again.",
      upgradeNeeded: isInsufficient,
      requiredCredits: legacyCreditResult.requiredCredits,
      creditsAvailable: legacyCreditResult.creditsAvailable,
    }, { status: isInsufficient ? 429 : 500 });
  }

  const results: Array<{ email: string; decision: string; score: number; reasons: string[]; blacklisted: boolean }> = [];
  const auditDecisions: Array<ReturnType<typeof buildContactAuditDecision>> = [];
  let blockedCount = 0;

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();
    if (!email) continue;

    const cacheKey = email + (targetIP || "");
    const cached = batchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < BATCH_CACHE_TTL) {
      const cachedResult = cached.result as Record<string, unknown>;
      const { record, auditDecision } = attachAuditFields(cachedResult, cachedResult);
      results.push(record as typeof results[0]);
      auditDecisions.push(auditDecision);
      if ((cachedResult as Record<string, unknown>).decision === "BLOCK") blockedCount++;
      continue;
    }

    const blHit = await checkBlacklist("email", email);
    if (blHit) {
      const r = { email, decision: "BLOCK", score: Number(blHit.risk_score) || 90, reasons: ["Blacklisted: " + (blHit.reason || "known risk")], blacklisted: true };
      const { record, auditDecision } = attachAuditFields(r, r);
      results.push(record as typeof results[0]); blockedCount++;
      auditDecisions.push(auditDecision);
      batchCache.set(cacheKey, { result: r as unknown as Record<string, unknown>, ts: Date.now() });
      continue;
    }

    const local = quickEmailCheck(email);
    if (local.score >= 60) {
      const r = { email, decision: "BLOCK", score: local.score, reasons: local.reasons, blacklisted: false };
      const { record, auditDecision } = attachAuditFields(r, r);
      results.push(record as typeof results[0]); blockedCount++;
      auditDecisions.push(auditDecision);
      batchCache.set(cacheKey, { result: r as unknown as Record<string, unknown>, ts: Date.now() });
      if (local.score >= 85) autoBlacklistIfHighRisk({ type: "email", value: email, risk_score: local.score, reasons: local.reasons }).catch(() => {});
      continue;
    }

    const decision = local.score >= 30 ? "REVIEW" : "ALLOW";
    const r = { email, decision, score: local.score, reasons: local.reasons, blacklisted: false };
    const { record, auditDecision } = attachAuditFields(r, r);
    results.push(record as typeof results[0]);
    auditDecisions.push(auditDecision);
    batchCache.set(cacheKey, { result: r as unknown as Record<string, unknown>, ts: Date.now() });
  }

  const total = results.length;
  const allowed = total - blockedCount;
  const campaignRisk = blockedCount > total * 0.3 ? "HIGH" : blockedCount > total * 0.1 ? "MEDIUM" : "LOW";
  const auditSummary = buildListAuditSummary(auditDecisions);

  getSupabaseAdmin().from("risk_logs").insert({
    user_id: cc.userId,
    ip: targetIP,
    email: JSON.stringify(emails.slice(0, 5)) + "...",
    risk_score: Math.round((blockedCount / total) * 100),
    decision: campaignRisk,
    source: "pre-send-batch",
    cost_units: cc.costUnits,
  }).then(() => {});

  return NextResponse.json({
    success: true,
    request_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    summary: { total, allowed, blocked: blockedCount },
    audit_summary: auditSummary,
    campaign_risk: campaignRisk,
    campaign_id: body.campaign_id || null,
    results,
    cost: {
      units_consumed: cc.costUnits,
      credits_deducted: legacyCreditResult.deducted,
      required_credits: legacyCreditResult.requiredCredits,
      credits_available_before: legacyCreditResult.creditsAvailable,
      credits_remaining: legacyCreditResult.creditsRemaining,
      monthly_remaining: cc.monthlyRemaining,
      daily_remaining: cc.dailyRemaining,
    },
    rate_limit: {
      ip_remaining: cc.ipRemaining,
      daily_remaining: cc.dailyRemaining,
      monthly_remaining: cc.monthlyRemaining,
    },
  });
}
