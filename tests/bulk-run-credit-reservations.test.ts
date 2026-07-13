import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/202607130005_credit_grant_ledger.sql", "utf8").toLowerCase();

describe("bulk grant reservations", () => {
  it("preserves the public bulk RPC signatures while removing direct balance arithmetic", () => {
    const replacement = sql.slice(sql.indexOf("-- bulk run ledger cutover"));
    expect(replacement).toContain("create or replace function public.create_bulk_run(");
    expect(replacement).toContain("create or replace function public.claim_bulk_run_chunk(");
    expect(replacement).toContain("create or replace function public.finalize_bulk_run_chunk(");
    expect(replacement).toContain("create or replace function public.fail_bulk_run_chunk(");
    expect(replacement).toContain("create or replace function public.release_bulk_run_unfinished(");
    expect(replacement).not.toContain("credits_remaining=credits_remaining+");
    expect(replacement).not.toContain("credits_remaining = credits_remaining -");
  });

  it("converts reservations to immutable usage and releases only unfinished allocations", () => {
    expect(sql).toContain("values(p_user_id,'finalize'");
    expect(sql).toContain("consumed_amount=consumed_amount+v_take");
    expect(sql).toContain("insert into public.credit_usage");
    expect(sql).toContain("perform public.release_grant_reservation");
    expect(sql).toContain("released_credits=released_credits+v_release");
  });
});
