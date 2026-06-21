import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateRiskScore, checkDomainAge, getDNSHealthScore, calculateCompanyHealth, cleanEmail, cleanEmails } from "@/lib/risk-engine";
import { costControlCheck } from "@/lib/cost-control";
import * as XLSX from "xlsx";

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
          getAll() { return request.cookies.getAll().map(c => ({ name: c.name, value: c.value })); },
          setAll() {},
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
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

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const contentType = request.headers.get("content-type") || "";
  let emails: string[] = [];
  let allRows: string[][] | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textField = formData.get("emails") as string | null;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = parseFileBuffer(buffer, file.name);
      emails = parsed.emails;
      allRows = parsed.rows;
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
    return NextResponse.json({ error: "No valid emails found. Please upload a CSV/XLSX file or paste emails." }, { status: 400 });
  }

  emails = emails.slice(0, 5000);

  // Process in batches
  const results: Array<{
    email: string;
    risk_score: number;
    health_score: number | null;
    decision: string;
    reasons: string[];
    disposable: boolean;
    hasMX: boolean;
    mxChecked: boolean;
    impact?: string[];
  }> = [];

  let cleanCount = 0, riskyCount = 0, blockedCount = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async (email) => {
      const domain = email.split("@")[1]?.toLowerCase();
      let domainAgeDays: number | null = null;
      if (domain) {
        try { const age = await checkDomainAge(domain); domainAgeDays = age.ageDays; } catch { /* skip */ }
      }
      const riskResult = await calculateRiskScore({ email, shouldCheckMX: true, domainAgeDays });
      const decision = riskResult.decision;

      let healthScore: number | null = null;
      const domain = email.split("@")[1]?.toLowerCase();
      if (domain) {
        try {
          const age = await checkDomainAge(domain);
          const health = await calculateCompanyHealth({
            riskScore: riskResult.score,
            isDisposable: !!riskResult.emailDetails?.isDisposable,
            hasMX: !!riskResult.emailDetails?.hasMX,
            hasSPF: !!riskResult.emailDetails?.hasSPF,
            hasDMARC: !!riskResult.emailDetails?.hasDMARC,
            dmarcPolicy: (riskResult.emailDetails?.dmarcPolicy as string) || "none",
            domainAgeDays: age.ageDays,
            isProxy: !!riskResult.ipDetails?.isProxy,
            isHosting: !!riskResult.ipDetails?.isHosting,
            blacklistHits: riskResult.blacklistHits || [],
            country: (riskResult.ipDetails?.countryCode as string) || null,
          });
          healthScore = health.healthScore;
        } catch { /* skip */ }
      }

      return {
        email,
        risk_score: riskResult.score,
        health_score: healthScore,
        risk_level: decision,
        reasons: riskResult.reasons,
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
    await getSupabaseAdmin().from("api_usage").insert({ user_id: user.id, date: today, request_count: results.length, plan: "free" });
  }

  const total = results.length;

  // Check if XLSX download requested
  const url = request.nextUrl;
  if (url.searchParams.get("format") === "xlsx") {
    const wsData = [["email", "risk_score", "health_score", "risk_level", "disposable", "hasMX", "reasons", "recommendation"]];
    for (const r of results) {
      wsData.push([r.email, String(r.risk_score), String(r.health_score ?? ""), r.risk_level, r.disposable ? "Yes" : "No", r.hasMX ? "Yes" : "No", r.reasons.join("; ")]);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "RiskShield Results");
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
    results,
  });
}
