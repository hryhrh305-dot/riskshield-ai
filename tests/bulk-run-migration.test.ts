import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202607120001_bulk_run_idempotency.sql"), "utf8");

describe("bulk run migration contract", () => {
  it("creates durable run and chunk tables with bounded contacts", () => {
    expect(migration).toContain("create table if not exists public.bulk_runs");
    expect(migration).toContain("create table if not exists public.bulk_run_chunks");
    expect(migration).toContain("total_contacts between 1 and 5000");
    expect(migration).toContain("contact_count between 1 and 50");
  });

  it("enforces idempotency, active duplicate protection, and payload integrity", () => {
    expect(migration).toContain("unique (user_id, idempotency_key)");
    expect(migration).toContain("bulk_runs_active_fingerprint_idx");
    expect(migration).toContain("BULK_RUN_DUPLICATE_CONTACT");
    expect(migration).toContain("BULK_RUN_CONTACT_LIMIT");
  });

  it("keeps write RPCs privileged and search-path pinned", () => {
    expect(migration).toContain("security definer set search_path = ''");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });

  it("reserves and releases credits inside database functions", () => {
    expect(migration).toContain("credits_remaining = credits_remaining - v_total");
    expect(migration).toContain("credits_remaining=credits_remaining+v_release");
    expect(migration).toContain("release_bulk_run_unfinished");
  });

  it("uses an expiring claim token to reject stale workers", () => {
    expect(migration).toContain("claim_token uuid");
    expect(migration).toContain("claim_token=gen_random_uuid()");
    expect(migration).toContain("BULK_RUN_STALE_CLAIM");
  });
});
