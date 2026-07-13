import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";

const sql=readFileSync("supabase/migrations/202607130008_credit_ledger_backfill.sql","utf8").toLowerCase();
describe("credit ledger backfill",()=>{
  it("snapshots every mirror and uses deterministic cutover references",()=>{
    expect(sql).toContain("credit_ledger_cutover_snapshots");
    expect(sql).toContain("secwyn-ledger-v1-20260713");
    expect(sql).toContain("on conflict (user_id, source_type, source_ref) do nothing");
  });
  it("preserves free, paid, business, and excess balances without automatic top-up",()=>{
    expect(sql).toContain("least(snapshot.credits_remaining,snapshot.entitlement)");
    expect(sql).toContain("greatest(snapshot.credits_remaining-snapshot.entitlement,0)");
    expect(sql).toContain("plan='business'");
    expect(sql).not.toContain("credits_remaining+50");
    expect(sql).toContain("credits_remaining<0 or credits_remaining is null");
    expect(sql).toContain("invalid_profile_balance_before_backfill");
  });
  it("asserts every compatibility mirror equals usable grant sums",()=>{
    expect(sql).toContain("credit_ledger_backfill_mismatch");
    expect(sql).toContain("sum(grant_row.remaining_amount)");
    expect(sql).toContain("raise exception");
  });
});
