import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateRiskScore, checkDomainAge, getAIExplanation, getCachedResult, getDNSHealthScore, makeResultCacheKey, setCachedResult, calculateCompanyHealth, cleanEmails } from "@/lib/risk-engine";
import * as XLSX from "xlsx";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";
import { buildContactAuditDecision, buildListAuditSummary } from "@/lib/list-audit";
import {
  getBatchExportColumnsForPlan,
  getResultCacheScope,
  isPlanAtLeast,
  sanitizeBatchResultForPlan,
  shouldUseAiExplanation,
  shouldUseDeepDetection,
} from "@/lib/plans";
import { consumeLegacyCredits, getUniqueBillableEmails } from "@/lib/legacy-credits";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ");
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
    const token = readAccessTokenFromCookieHeader(cookieHeader, "njhjiavnidssjvnkcxfo");
    if (!token) return null;
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch { return null; }
}
function parseEmails(text: string): string[] {
  const lines = text.split(/[\s,;]+/);
  return cleanEmails(lines);
}

// Detect column index for email in XLSX/CSV data
function findEmailColumn(headers: string[]): number {
  const emailKeys = ["email", "e-mail", "mail", "email_address", "emailaddress", "address"];
  for (const key of emailKeys) {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === key);
    if (idx >= 0) return idx;
  }
  // Fallback: first column containing "@"
  return -1;
}

// Parse XLSX/CSV buffer into email array + preserve all rows
function parseFileBuffer(buffer: Buffer, filename: string): { emails: string[]; rows: string[][] } {
  const isXLSX = filename.endsWith(".xlsx") || filename.endsWith(".xls");
  let rows: string[][] = [];

  if (isXLSX) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
  } else {
    const text = buffer.toString("utf-8");
    rows = text.split(/[\r\n]+/).map(line => line.split(/[,;\t]/).map(c => c.trim()));
  }

  if (rows.length === 0) return { emails: [], rows: [] };

  // Find email column
  const headers = rows[0];
  const emailCol = findEmailColumn(headers);

  let emails: string[] = [];
  if (emailCol >= 0) {
    emails = rows.slice(1)
      .map(r => (r[emailCol] || "").trim().toLowerCase())
      .filter(e => !!e);
    emails = cleanEmails(emails);
  } else {
    // Fallback: scan all cells for emails
    const emailSet = new Set<string>();
    for (const row of rows) {
      for (const cell of row) {
        const v = (cell || "").trim().toLowerCase();
        if (v.includes("@")) emailSet.add(v);
      }
    }
    emails = cleanEmails([...emailSet]);
  }

  return { emails, rows };
}

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

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const { data: profile } = await getSupabaseAdmin()
    .from("profiles")
    .select("plan, credits_remaining")
    .eq("id", user.id)
    .single();
  const plan = profile?.plan || "free";

  if (!isPlanAtLeast(plan, "starter")) {
    return NextResponse.json({
      error: "BULK_PLAN_REQUIRED",
      message: "Bulk list screening starts on Starter. Upgrade to scan CSV, TXT, or XLSX files.",
      upgradeNeeded: true,
      plan,
    }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") || "";
  let emails: string[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textField = formData.get("emails") as string | null;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = parseFileBuffer(buffer, file.name);
      emails = parsed.emails;
    } else if (textField) {
      emails = parseEmails(textField);
    }
  } else {
    try {
      const body = await request.json();
      if (body.emails && Array.isArray(body.emails)) {
        emails = cleanEmails(body.emails);
      } else if (body.text) {
        emails = parseEmails(body.text);
      }
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  }

  if (emails.length === 0) {
    return NextResponse.json({ error: "No valid emails found. Please upload a CSV, TXT, or XLSX file, or paste emails one per line or separated by spaces." }, { status: 400 });
  }

  emails = emails.slice(0, 5000);

  // === P0 HOTFIX: Deduplicate and consume credits BEFORE running checks ===
  const uniqueEmails = getUniqueBillableEmails(emails);
  const requiredCredits = uniqueEmails.length;

  if (requiredCredits > 5000) {
    return NextResponse.json({ error: "Too many contacts. Maximum is 5000 per request." }, { status: 400 });
  }

  const legacyCreditResult = await consumeLegacyCredits({
    supabase: getSupabaseAdmin(),
    userId: user.id,
    requiredCredits,
  });

  if (!legacyCreditResult.ok) {
    const isInsufficient = legacyCreditResult.error === "INSUFFICIENT_CREDITS";
    return NextResponse.json({
      error: "Insufficient credits",
      message: isInsufficient
        ? "Insufficient credits for bulk scan. Upgrade your plan."
        : "Failed to process credit. Please try again.",
      upgradeNeeded: isInsufficient,
      requiredCredits: legacyCreditResult.requiredCredits,
      creditsAvailable: legacyCreditResult.creditsAvailable,
    }, { status: isInsufficient ? 429 : 500 });
  }

  // Process in batches
  const results: Array<Record<string, unknown>> = [];
  const auditDecisions: Array<ReturnType<typeof buildContactAuditDecision>> = [];

  let cleanCount = 0, riskyCount = 0, blockedCount = 0;
  const BATCH_SIZE = 10;
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

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async (email) => {
      const domain = email.split("@")[1]?.toLowerCase();
      const useDeepDetection = shouldUseDeepDetection(plan);
      if (domain) uniqueDomains.add(domain);
      const cacheKey = makeResultCacheKey(email, null) + ":" + getResultCacheScope(plan);
      const cached = getCachedResult(cacheKey);
      if (cached) {
        cacheHits++;
        const sanitized = sanitizeBatchResultForPlan({ ...cached, cached: true }, plan);
        const { record, auditDecision } = attachAuditFields(sanitized, cached);
        auditDecisions.push(auditDecision);
        return record;
      }
      cacheMisses++;

      let domainAge: Awaited<ReturnType<typeof checkDomainAge>> | null = null;
      let domainAgeDays: number | null = null;
      if (domain && useDeepDetection) {
        domainAge = await getSharedDomainAge(domain);
        domainAgeDays = domainAge?.ageDays ?? null;
      }

      const riskResult = await calculateRiskScore({ email, shouldCheckMX: true, domainAgeDays: useDeepDetection ? domainAgeDays : null });
      const decision = riskResult.decision;

      let healthScore: number | null = null;
      let dnsHealth: Awaited<ReturnType<typeof getDNSHealthScore>> | null = null;
      let companyHealth: Awaited<ReturnType<typeof calculateCompanyHealth>> | null = null;
      if (domain && useDeepDetection) {
        try {
          if (!domainAge) throw new Error("Domain age unavailable");
          dnsHealth = await getSharedDNSHealth(domain);
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
          healthScore = companyHealth.healthScore;
        } catch { /* skip */ }
      }

      const rawResult = {
        email,
        risk_score: riskResult.score,
        health_score: healthScore,
        risk_level: decision,
        reasons: riskResult.reasons,
        details: riskResult.emailDetails,
        domain_age: domainAge,
        dns_health: dnsHealth,
        company_health: companyHealth,
        ai_explanation: null as Awaited<ReturnType<typeof getAIExplanation>> | null,
        risk_factors: riskResult.risk_factors || [],
        recommendation: riskResult.recommendation || "",
        estimated_waste_cost: riskResult.estimated_waste_cost ?? 0,
        disposable: (riskResult.emailDetails?.isDisposable as boolean) || false,
        hasMX: (riskResult.emailDetails?.hasMX as boolean) || false,
        mxChecked: (riskResult.emailDetails?.mxChecked as boolean) || false,
        impact: riskResult.impact || [],
        solution: riskResult.solution || [],
        cached: false,
      };
      if (shouldUseAiExplanation(plan)) {
        const aiStartedAt = Date.now();
        rawResult.ai_explanation = await getAIExplanation(email, null, riskResult.score, riskResult.reasons, plan);
        aiExplanationMs += Date.now() - aiStartedAt;
      }
      setCachedResult(cacheKey, rawResult);
      const sanitized = sanitizeBatchResultForPlan(rawResult, plan);
      const { record, auditDecision } = attachAuditFields(sanitized, rawResult);
      auditDecisions.push(auditDecision);
      return record;
    }));

    for (const r of batchResults) {
      if (r.risk_level === "ALLOW") cleanCount++;
      else if (r.risk_level === "REVIEW") riskyCount++;
      else blockedCount++;
      results.push(r);
    }
  }

  // Save usage
  // Record bulk usage
  const today = new Date().toISOString().split("T")[0];
  const { data: todayUsg } = await getSupabaseAdmin().from("api_usage").select("request_count").eq("user_id", user.id).eq("date", today).maybeSingle();
  if (todayUsg) {
    await getSupabaseAdmin().from("api_usage").update({ request_count: (todayUsg.request_count || 0) + results.length }).eq("user_id", user.id).eq("date", today);
  } else {
    await getSupabaseAdmin().from("api_usage").insert({ user_id: user.id, date: today, request_count: results.length, plan });
  }

  const total = results.length;
  const auditSummary = buildListAuditSummary(auditDecisions);
  console.info("[bulk-check] performance", {
    total,
    durationMs: Date.now() - startedAt,
    cacheHits,
    cacheMisses,
    uniqueDomains: uniqueDomains.size,
    reusedDomainChecks,
    aiExplanationMs,
    plan,
  });

  // Check if XLSX download requested
  const url = request.nextUrl;
  if (url.searchParams.get("format") === "xlsx") {
    const exportColumns = getBatchExportColumnsForPlan(plan);
    const wsData = [exportColumns.map((item) => item.label)];
    for (const record of results) {
      const row = exportColumns.map((item) => {
        const value = (record as Record<string, unknown>)[item.key];
        if (Array.isArray(value)) return value.join("; ");
        if (typeof value === "boolean") return value ? "Yes" : "No";
        return value == null ? "" : String(value);
      });
      wsData.push(row);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Secwyn Results");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=riskshield-results.xlsx",
      },
    });
  }

  return NextResponse.json({
    success: true,
    plan,
    detail_tier: getResultCacheScope(plan),
    export_columns: getBatchExportColumnsForPlan(plan),
    credits: {
      deducted: legacyCreditResult.deducted,
      requiredCredits: legacyCreditResult.requiredCredits,
    },
    summary: {
      total,
      clean: cleanCount,
      risky: riskyCount,
      blocked: blockedCount,
      clean_pct: Math.round((cleanCount / total) * 100),
      risky_pct: Math.round((riskyCount / total) * 100),
      blocked_pct: Math.round((blockedCount / total) * 100),
      estimated_waste_pct: Math.round((blockedCount / total) * 100),
    },
    audit_summary: auditSummary,
    results,
  });
}
