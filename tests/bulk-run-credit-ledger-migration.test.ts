import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path = "supabase/migrations/202607130005_credit_grant_ledger.sql";
const sql = existsSync(path) ? readFileSync(path, "utf8").toLowerCase() : "";

describe("credit grant ledger migration", () => {
  it("creates protected authoritative grant and usage tables", () => {
    expect(sql).toContain("create table if not exists public.credit_grants");
    expect(sql).toContain("create table if not exists public.credit_usage");
    expect(sql).toContain("create table if not exists public.credit_reservation_allocations");
    expect(sql).toContain("create table if not exists public.credit_operations");
    expect(sql).toContain("unique (user_id, source_type, source_ref)");
    expect(sql).toContain("credit_type in ('contact_audit','client_report')");
    expect(sql).toContain("billing_period_start timestamptz");
    expect(sql).toContain("credit_grants_subscription_cycle_uidx");
    expect(sql).toContain("unique (user_id, operation_type, idempotency_key)");
    expect(sql).toContain("consumed_amount + released_amount <= reserved_amount");
    expect(sql.match(/enable row level security/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("provides atomic consume, reserve, release, summary, and grant functions", () => {
    expect(sql).toContain("create or replace function public.grant_cycle_credits");
    expect(sql).toContain("create or replace function public.consume_grant_credits");
    expect(sql).toContain("create or replace function public.reserve_grant_credits");
    expect(sql).toContain("create or replace function public.release_grant_reservation");
    expect(sql).toContain("create or replace function public.get_credit_summary");
    expect(sql).toContain("source_type = 'referral_bonus'");
    expect(sql).toContain("credits_remaining = v_total_remaining");
    expect(sql).toContain("for update");
    expect(sql).toContain("idempotency_conflict");
  });

  it("keeps privileged functions service-role-only", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("revoke execute on function public.consume_credit(uuid)");
    expect(sql).toContain("protect_profile_credit_mirror");
  });

  it("restores the original grant before marking a reservation released", () => {
    const functionStart = sql.indexOf("create or replace function public.release_grant_reservation");
    const functionEnd = sql.indexOf("create or replace function public.protect_profile_credit_mirror");
    const release = sql.slice(functionStart, functionEnd);
    expect(release.indexOf("update public.credit_grants")).toBeGreaterThan(-1);
    expect(release.indexOf("update public.credit_grants")).toBeLessThan(release.indexOf("update public.credit_reservation_allocations"));
    expect(release).toContain("get diagnostics v_updated = row_count");
  });
});
