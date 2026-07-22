import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync("supabase/migrations/202607220001_india_affiliate_platform.sql","utf8");
const leaderPage=readFileSync("src/app/affiliate/leader/page.tsx","utf8");
const affiliateServer=readFileSync("src/modules/affiliate/application/server.ts","utf8");

describe("affiliate additive schema and security contract",()=>{
  it("uses only affiliate-prefixed new objects",()=>{
    const created=[...migration.matchAll(/create table if not exists public\.([a-z0-9_]+)/g)].map((match)=>match[1]);
    expect(created.length).toBeGreaterThan(20);
    expect(created.every((name)=>name.startsWith("affiliate_"))).toBe(true);
  });
  it("enables RLS and revokes direct public access",()=>{
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.%I from public,anon,authenticated");
  });
  it("makes rule, decision, ledger and audit history immutable",()=>{
    for(const trigger of ["affiliate_rule_immutable","affiliate_decision_immutable","affiliate_ledger_append_only","affiliate_audit_append_only"]) expect(migration).toContain(trigger);
  });
  it("keeps shadow entries outside payable balances and schedules every installment",()=>{
    expect(migration).toContain("posting_state text not null");
    expect(migration).toContain("jsonb_array_elements(p_schedule)");
    expect(migration).toContain("AFFILIATE_SCHEDULE_TOTAL_MISMATCH");
  });
  it("uses transactional application, attribution, content and shadow commands",()=>{
    for(const rpc of ["affiliate_submit_application","affiliate_review_application","affiliate_lock_attribution","affiliate_publish_content","affiliate_record_shadow_decision"]) expect(migration).toContain(`function public.${rpc}`);
  });
  it("has database unique constraints for event, sale, decision and ledger idempotency",()=>{
    expect(migration).toContain("unique(program_id,provider,provider_transaction_id)");
    expect(migration).toContain("unique(program_id,sale_id)");
    expect(migration).toContain("unique(program_id,idempotency_key)");
    expect(migration).toContain("primary key(namespace,key)");
  });
  it("keeps the leader surface aggregate-only and behind the ordered team flag",()=>{
    expect(leaderPage).toContain('"AFFILIATE_TEAM_REWARDS"');
    expect(leaderPage).toContain('membership.status !== "approved"');
    expect(affiliateServer).toContain('select("id,name,status")');
    expect(affiliateServer).toContain('select("id", { count: "exact", head: true })');
    expect(affiliateServer).not.toContain('affiliate_customer_identity_links").select');
  });
});
