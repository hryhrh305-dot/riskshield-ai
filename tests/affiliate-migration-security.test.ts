import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync("supabase/migrations/202607220001_india_affiliate_platform.sql","utf8");
const leaderPage=readFileSync("src/app/affiliate/leader/page.tsx","utf8");
const affiliateServer=readFileSync("src/modules/affiliate/application/server.ts","utf8");
const seeder=readFileSync("scripts/seed-affiliate-content.mjs","utf8");
const telegramWorker=readFileSync("src/app/api/cron/affiliate-telegram/route.ts","utf8");

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
    for(const trigger of ["affiliate_rule_immutable","affiliate_decision_immutable","affiliate_commission_audit_immutable","affiliate_ledger_append_only","affiliate_payout_batch_immutable","affiliate_payout_item_immutable","affiliate_audit_append_only"]) expect(migration).toContain(trigger);
  });
  it("keeps shadow entries outside payable balances and schedules every installment",()=>{
    expect(migration).toContain("posting_state text not null");
    expect(migration).toContain("jsonb_array_elements(p_schedule)");
    expect(migration).toContain("AFFILIATE_SCHEDULE_TOTAL_MISMATCH");
  });
  it("uses transactional application, attribution, content and shadow commands",()=>{
    for(const rpc of ["affiliate_submit_application","affiliate_review_application","affiliate_publish_rule_schedule","affiliate_lock_attribution","affiliate_publish_content","affiliate_record_shadow_decision","affiliate_record_sale_decision","affiliate_record_reversal"]) expect(migration).toContain(`function public.${rpc}`);
    expect(migration).toContain("affiliate.commission.shadow_recorded");
    expect(migration).toContain("affiliate.sale.'||p_reversal_type");
    expect(migration).toContain("AFFILIATE_REVERSAL_IDEMPOTENCY_CONFLICT");
    expect(migration).toContain("AFFILIATE_CLAWBACK_EXCEEDS_DECISION");
    expect(migration).toContain("v_prior_reversed_gross+p_reversed_gross_minor>=v_sale.gross_amount_minor");
    expect(migration).toContain("affiliate_claim_telegram_publications");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("affiliate_telegram_daily_uidx");
    expect(migration).toContain("AFFILIATE_APPLICATION_NOT_REVIEWABLE");
    expect(migration).toContain("AFFILIATE_APPLICATION_NOT_SUSPENDABLE");
    expect(migration).toContain("p_launch_start_at+interval '12 months'");
    expect(migration).toContain("where publication_type='daily_content';");
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
  it("models separated operator duties without trusting client claims",()=>{
    expect(migration).toContain("affiliate_operator_roles");
    for(const role of ["content_editor","compliance_reviewer","program_manager","publisher","affiliate_admin","super_admin"]) expect(migration).toContain(`'${role}'`);
    expect(affiliateServer).toContain("requireAffiliateOperator");
    expect(affiliateServer).toContain('eq("user_id",user.id)');
  });
  it("records all seven existing Telegram messages without editing the real channel",()=>{
    expect(migration).toContain("check(slot between 1 and 7)");
    expect(seeder).toContain("TG_SECWYN_INDIA_APPLICATION_PENDING");
    expect(seeder).toContain('messageId:"11"');
    expect(seeder).toContain('replacementRequired:true');
    expect(seeder).toContain('ignoreDuplicates:true');
  });
  it("claims Telegram work atomically and only completes rows owned by that worker",()=>{
    expect(telegramWorker).toContain('rpc("affiliate_claim_telegram_publications"');
    expect(telegramWorker).toContain('.eq("status","processing").eq("locked_by",worker)');
    expect(telegramWorker).toContain('status:"unknown_delivery"');
    expect(telegramWorker).not.toContain('.from("affiliate_telegram_publications").select("*").eq("status","pending")');
  });
});
