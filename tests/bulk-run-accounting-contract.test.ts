import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync("src/app/(dashboard)/dashboard/page.tsx", "utf8");
const sheets = readFileSync("google-sheets-addon/Code.gs", "utf8");
const webBulk = readFileSync("src/app/api/bulk-check/route.ts", "utf8");
const sheetsBatch = readFileSync("src/app/api/v1/email/batch-check/route.ts", "utf8");
const migrationPath = "supabase/migrations/202607130002_restore_usage_accounting.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const abuseIndexMigration = readFileSync("supabase/migrations/202607130003_index_abuse_events_api_key.sql", "utf8");

describe("credit accounting and dashboard contract", () => {
  it("aligns dashboard usage with the current credit balance and locked boundaries", () => {
    expect(dashboard).toContain('gte("risk_score", 26).lte("risk_score", 65)');
    expect(dashboard).toContain('gte("risk_score", 66)');
    expect(dashboard).not.toContain('gte("risk_score", 40).lte("risk_score", 69)');
    expect(dashboard).toContain("Math.max(0, monthlyLimit - displayCreditsRemaining)");
    expect(dashboard).toContain("Current Credit Cycle");
    expect(dashboard).toContain("subscriptionRow?.current_period_start || startOfMonth");
    expect(dashboard).toContain("credits used");
  });

  it("states that cached Sheets results are charged", () => {
    expect(sheets).not.toContain("Cached (free)");
    expect(sheets).toContain("Cached (charged)");
    expect(sheets).toContain("r.risk_score >= 66");
    expect(sheets).toContain("r.risk_score >= 26");
    expect(sheets).not.toContain("r.risk_score >= 70");
    expect(sheets).not.toContain("r.risk_score >= 40");
  });

  it("persists successful legacy batch outcomes before returning", () => {
    expect(webBulk).toContain('await getSupabaseAdmin().from("scan_history").insert(');
    expect(sheetsBatch).toContain('await getSupabaseAdmin().from("scan_history").insert(');
  });

  it("does not charge a Sheets/API batch before quota checks accept it", () => {
    const quotaCheck = sheetsBatch.indexOf("dailyUsed + batchSize > limits.dailyUnits");
    const creditCharge = sheetsBatch.indexOf("const legacyCreditResult = await consumeLegacyCredits");
    expect(quotaCheck).toBeGreaterThan(-1);
    expect(creditCharge).toBeGreaterThan(quotaCheck);
  });

  it("creates protected usage and abuse ledgers required by cost control", () => {
    expect(migration).toContain("create table if not exists public.usage_ledger");
    expect(migration).toContain("create table if not exists public.abuse_events");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.usage_ledger from anon, authenticated");
    expect(migration).toContain("usage_ledger_user_created_idx");
    expect(abuseIndexMigration).toContain("abuse_events_api_key_created_idx");
  });
});
