import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateAffiliateActivation,
  type AffiliateActivationEvidence,
} from "@/modules/affiliate/domain/activation";
import {
  assertAffiliateSameOrigin,
  isAffiliatePreviewRuntime,
} from "@/modules/affiliate/application/preview";
import { TelegramBotAdapter } from "@/modules/affiliate/ports/telegram";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Affiliate Preview operational acceptance contracts", () => {
  it("opens Preview-only operations only on the isolated acceptance branch", () => {
    expect(isAffiliatePreviewRuntime({
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "codex/secwyn-india-affiliate-full",
    })).toBe(true);
    expect(isAffiliatePreviewRuntime({
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "codex/secwyn-india-affiliate-full",
    })).toBe(false);
    expect(isAffiliatePreviewRuntime({
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "main",
    })).toBe(false);
  });

  it("rejects cross-origin Affiliate mutations", () => {
    const request = new Request("https://preview.secwyn.test/api/affiliate/applications", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(() => assertAffiliateSameOrigin(request)).toThrow("AFFILIATE_CSRF_REJECTED");
    expect(() => assertAffiliateSameOrigin(new Request(
      "https://preview.secwyn.test/api/affiliate/applications",
      { method: "POST", headers: { origin: "https://preview.secwyn.test" } },
    ))).not.toThrow();
  });

  it("approves provisional activation after three actions across two formats", () => {
    const evidence: AffiliateActivationEvidence = {
      actions: [
        { actionType: "share", format: "post" },
        { actionType: "demo", format: "call" },
        { actionType: "follow_up", format: "post" },
      ],
      eventTypes: [],
      graceUsed: false,
    };
    expect(evaluateAffiliateActivation(evidence)).toEqual({ eligible: true, reason: "actions" });
  });

  it.each(["referred_registration", "verified_opportunity", "first_payment"] as const)(
    "accepts %s as an early activation path",
    (eventType) => {
      expect(evaluateAffiliateActivation({ actions: [], eventTypes: [eventType], graceUsed: false }))
        .toEqual({ eligible: true, reason: eventType });
    },
  );

  it("allows one grace extension and never a second", () => {
    expect(evaluateAffiliateActivation({ actions: [], eventTypes: [], graceUsed: false, expired: true }))
      .toEqual({ eligible: false, reason: "grace_available" });
    expect(evaluateAffiliateActivation({ actions: [], eventTypes: [], graceUsed: true, expired: true }))
      .toEqual({ eligible: false, reason: "expired" });
  });

  it("verifies the private Telegram target before a canary send", async () => {
    const calls: string[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      calls.push(String(input));
      return Response.json({ ok: true, result: { id: -1001, title: "Secwyn Affiliate Bot Test", type: "channel" } });
    };
    const adapter = new TelegramBotAdapter("synthetic-token", "synthetic-chat", fakeFetch);
    await expect(adapter.assertPrivateCanaryTarget()).resolves.toEqual({ title: "Secwyn Affiliate Bot Test", type: "channel" });
    expect(calls[0]).toContain("/getChat");
  });

  it("denies the real Affiliate Telegram channel", async () => {
    const fakeFetch: typeof fetch = async () => Response.json({
      ok: true,
      result: { id: -1002, title: "Secwyn India Affiliate Updates", username: "SecwynIndiaAffiliate", type: "channel" },
    });
    const adapter = new TelegramBotAdapter("synthetic-token", "synthetic-chat", fakeFetch);
    await expect(adapter.assertPrivateCanaryTarget()).rejects.toThrow("AFFILIATE_TELEGRAM_REAL_CHANNEL_DENIED");
  });

  it("exposes the required operational status without enabling real money movement", () => {
    const portal = read("src/app/affiliate/portal/page.tsx");
    const admin = read("src/app/admin/affiliate/page.tsx");
    const content = read("src/app/admin/affiliate/content/AffiliateContentEditor.tsx");
    expect(portal).toContain("India Founding Affiliate");
    expect(portal).toContain("Activation progress");
    expect(portal).toContain("Payout readiness");
    expect(portal).toContain("Direct relationships only");
    expect(admin).toContain("Application review queue");
    expect(admin).toContain("Rule versions");
    expect(admin).toContain("Telegram queue");
    expect(content).toContain("Resolve impact");
    expect(content).toContain("Rollback draft");
    expect(content).toContain("Export JSON");
  });

  it("protects application submission with CSRF, rate limiting and replay idempotency", () => {
    const route = read("src/app/api/affiliate/applications/route.ts");
    expect(route).toContain("assertAffiliateSameOrigin");
    expect(route).toContain("AFFILIATE_APPLICATION_RATE_LIMITED");
    expect(route).toContain("affiliate_submit_application_v2");
    expect(route).toContain("p_request_id");
  });

  it("adds transactional activation, grace and attribution-extension commands", () => {
    const migration = read("supabase/migrations/202607220003_affiliate_preview_operational_acceptance.sql");
    expect(migration).toContain("affiliate_record_activation_evidence");
    expect(migration).toContain("affiliate_request_activation_grace");
    expect(migration).toContain("affiliate_extend_attribution_once");
    expect(migration).toContain("interval '3 days'");
    expect(migration).toContain("interval '30 days'");
  });

  it("keeps the private Telegram canary route Preview-only and fixed-target", () => {
    const route = read("src/app/api/admin/affiliate/telegram-canary/route.ts");
    expect(route).toContain("isAffiliatePreviewRuntime");
    expect(route).toContain("assertAffiliateSameOrigin");
    expect(route).toContain("assertPrivateCanaryTarget");
    expect(route).not.toMatch(/chatId|chat_id|messageBody|message_body/);
  });
});
