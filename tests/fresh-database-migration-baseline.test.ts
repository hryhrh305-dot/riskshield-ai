import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const migrations = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const baselineName = "202607090001_secwyn_core_schema_baseline.sql";
const baseline = readFileSync(join(migrationDirectory, baselineName), "utf8").toLowerCase();
const replay = migrations
  .map((name) => readFileSync(join(migrationDirectory, name), "utf8").toLowerCase())
  .join("\n");

describe("fresh database migration baseline", () => {
  it("runs before every historical Secwyn migration", () => {
    expect(migrations[0]).toBe(baselineName);
    expect(migrations).toEqual([...migrations].sort());
  });

  it("creates the complete repository-backed api_keys contract", () => {
    expect(baseline).toContain("create table if not exists public.api_keys");
    for (const column of ["id uuid primary key", "user_id uuid not null", "key text not null unique", "name text not null", "status text not null", "created_at timestamptz", "last_used_at timestamptz"]) {
      expect(baseline).toContain(column);
    }
    expect(baseline).toContain("status in ('active','revoked')");
    expect(baseline).toContain("alter table public.api_keys enable row level security");
    expect(baseline).toContain("api_keys_user_created_idx");
  });

  it("creates every core relation before later foreign keys and functions use it", () => {
    const required = [
      "profiles", "api_keys", "api_usage", "checks", "subscriptions", "payments",
      "pre_send_checks", "pre_send_results", "feedback_messages",
    ];
    for (const table of required) {
      expect(baseline).toContain(`create table if not exists public.${table}`);
    }
    expect(baseline.indexOf("create table if not exists public.api_keys"))
      .toBeLessThan(baseline.indexOf("create table if not exists public.api_usage"));
    expect(migrations.indexOf(baselineName))
      .toBeLessThan(migrations.indexOf("202607130002_restore_usage_accounting.sql"));
  });

  it("preserves the usage ledger foreign key and all authoritative credit relations", () => {
    expect(replay).toContain("api_key_id uuid references public.api_keys(id) on delete set null");
    for (const table of ["credit_operations", "credit_grants", "credit_usage", "credit_reservation_allocations"]) {
      expect(replay).toContain(`create table if not exists public.${table}`);
    }
  });

  it("enables RLS and fixes search_path on privileged baseline functions", () => {
    for (const table of ["profiles", "api_keys", "api_usage", "checks", "subscriptions", "payments", "pre_send_checks", "pre_send_results", "feedback_messages"]) {
      expect(baseline).toContain(`alter table public.${table} enable row level security`);
    }
    expect(baseline.match(/security definer\s+set search_path = ''/g)?.length).toBe(2);
    expect(baseline).toContain("revoke all on function public.handle_new_user()");
    expect(baseline).toContain("grant execute on function public.increment_api_usage(uuid,uuid,text,date) to service_role");
  });

  it("contains all Affiliate tables and transactional RPCs in the replay", () => {
    expect(replay.match(/create table if not exists public\.affiliate_/g)?.length).toBeGreaterThanOrEqual(59);
    for (const fn of [
      "affiliate_claim_idempotency", "affiliate_submit_application", "affiliate_review_application",
      "affiliate_publish_rule_schedule", "affiliate_lock_attribution", "affiliate_publish_content",
      "affiliate_record_shadow_decision", "affiliate_record_real_decision",
      "affiliate_record_sale_decision", "affiliate_record_reversal", "affiliate_claim_outbox",
      "affiliate_claim_telegram_publications",
    ]) {
      expect(replay).toContain(`function public.${fn}`);
    }
  });

  it("hardens provider facts, outbox payloads, reconciliations, and payout snapshots", () => {
    expect(replay).toContain("affiliate_provider_sale_immutable");
    expect(replay).toContain("affiliate_outbox_event_immutable");
    expect(replay).toContain("affiliate_reconciliation_immutable");
    expect(replay).toContain("affiliate_payout_snapshot_immutable");
    expect(replay).toContain("before update or delete on public.affiliate_sales");
    expect(replay).toContain("before update or delete on public.affiliate_outbox_events");
  });
});
