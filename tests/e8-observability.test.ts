import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createCid, verifyCid } from "../src/lib/e8/cid";
import { getE8Flags } from "../src/lib/e8/flags";
import { parseProductEvent } from "../src/lib/e8/validation";
import { parseSesNotification, sesDedupKey, suppressionReasonForEvent } from "../src/lib/e8/ses";
import { snsCanonicalString, validateSnsEnvelope, verifySnsSignatureWithPem } from "../src/lib/e8/sns";
import { generateKeyPairSync, sign } from "node:crypto";
import { canonicalActivationKey, createAnonymousSession, createOpaqueLandingKey, verifyAnonymousSession } from "../src/lib/e8/anonymous";
import { isSameOrigin, safeRate } from "../src/lib/e8/security";
import { buildCreemCheckoutMetadata, classifyCreemSubscriptionPaid } from "../src/lib/e8/creem";
import { recordSesEvent, recordSubscriptionEvent } from "../src/lib/e8/repository";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("E8 feature safety", () => {
  it("defaults every feature off and the global kill switch on", () => {
    expect(getE8Flags({})).toEqual({
      observability: false,
      sesIngestion: false,
      attribution: false,
      creemMetadata: false,
      safetyAutopause: false,
      dashboard: false,
      globalKillSwitch: true,
    });
  });
  it("honors explicit flags without weakening the kill switch default", () => {
    expect(getE8Flags({ OUTREACH_OBSERVABILITY_ENABLED: "true", OUTREACH_GLOBAL_KILL_SWITCH: "false" })).toMatchObject({ observability: true, globalKillSwitch: false });
    expect(getE8Flags({ OUTREACH_GLOBAL_KILL_SWITCH: "true" }).globalKillSwitch).toBe(true);
  });
  it("accepts only probability thresholds in the open-closed unit interval", () => {
    expect(safeRate("0.02", 0.5)).toBe(0.02);
    expect(safeRate("0", 0.5)).toBe(0.5);
    expect(safeRate("1.1", 0.5)).toBe(0.5);
  });
});

describe("E8 cid", () => {
  const keys = { current: "current-test-key-with-enough-entropy", previous: "previous-test-key-with-enough-entropy" };
  it("accepts valid tokens and rotated previous keys", () => {
    const token = createCid({ campaignId: "550e8400-e29b-41d4-a716-446655440000", prospectId: "550e8400-e29b-41d4-a716-446655440001", outreachMessageId: "550e8400-e29b-41d4-a716-446655440002", ttlSeconds: 60 }, keys.previous!, "previous");
    expect(verifyCid(token, keys)).toMatchObject({ campaignId: "550e8400-e29b-41d4-a716-446655440000", prospectId: "550e8400-e29b-41d4-a716-446655440001", outreachMessageId: "550e8400-e29b-41d4-a716-446655440002" });
  });
  it("rejects tampered and expired tokens", () => {
    const token = createCid({ campaignId: "550e8400-e29b-41d4-a716-446655440000", ttlSeconds: 60 }, keys.current);
    expect(verifyCid(`${token}x`, keys)).toBeNull();
    const expired = createCid({ campaignId: "550e8400-e29b-41d4-a716-446655440000", ttlSeconds: -1 }, keys.current);
    expect(verifyCid(expired, keys)).toBeNull();
    expect(verifyCid(token, { current: "different-test-key-with-enough-entropy" })).toBeNull();
    expect(verifyCid("not-a-token", keys)).toBeNull();
  });
});

describe("E8 signed anonymous session", () => {
  const key = "anonymous-test-key-with-at-least-32-characters";
  it("accepts valid signed sessions and rejects expiry/tamper/wrong key", () => {
    const token = createAnonymousSession({ anonymousId: crypto.randomUUID(), ttlSeconds: 60 }, key);
    expect(verifyAnonymousSession(token, key)?.anonymousId).toMatch(/^[0-9a-f-]{36}$/);
    expect(verifyAnonymousSession(`${token}x`, key)).toBeNull();
    expect(verifyAnonymousSession(token, "other-anonymous-test-key-with-32-characters")).toBeNull();
    expect(verifyAnonymousSession(createAnonymousSession({ anonymousId: crypto.randomUUID(), ttlSeconds: -1 }, key), key)).toBeNull();
  });
  it("requires exact same origin", () => {
    expect(isSameOrigin("https://www.secwyn.com", "https://www.secwyn.com/path")).toBe(true);
    expect(isSameOrigin("https://evil.example", "https://www.secwyn.com/path")).toBe(false);
    expect(isSameOrigin(null, "https://www.secwyn.com/path")).toBe(false);
  });
  it("derives bounded opaque landing and canonical activation keys without exposing source identifiers", () => {
    const jti = "550e8400-e29b-41d4-a716-446655440000";
    const landing = createOpaqueLandingKey(jti, key);
    expect(landing).toMatch(/^[A-Za-z0-9_-]{20,120}$/);
    expect(landing).not.toContain(jti);
    expect(createOpaqueLandingKey(jti, key)).toBe(landing);

    const userId = "550e8400-e29b-41d4-a716-446655440001";
    expect(canonicalActivationKey(userId, key)).toBe(canonicalActivationKey(userId, key));
    expect(canonicalActivationKey(userId, key)).toMatch(/^activation:v1:[A-Za-z0-9_-]{20,120}$/);
    expect(canonicalActivationKey(userId, key)).not.toContain(userId);
  });
});

describe("E8 Creem metadata contract", () => {
  const base = { user_id: "u", plan: "growth", billing_interval: "monthly", source: "pricing-page" };
  it("is byte-shape compatible with the legacy four fields when disabled", () => {
    expect(buildCreemCheckoutMetadata(base, null, "request-1", false)).toEqual(base);
    expect(Object.keys(buildCreemCheckoutMetadata(base, null, "request-1", false))).toEqual(["user_id", "plan", "billing_interval", "source"]);
  });
  it("classifies paid events by provider period fields, never arrival order", () => {
    expect(classifyCreemSubscriptionPaid({ current_period_start_date: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" })).toBe("first_payment");
    expect(classifyCreemSubscriptionPaid({ current_period_start_date: "2026-02-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" })).toBe("renewal");
    expect(classifyCreemSubscriptionPaid({})).toBe("subscription_paid_unclassified");
  });
});

describe("E8 strict validation", () => {
  it("accepts the supported product events and rejects unknown/PII-shaped values", () => {
    expect(parseProductEvent({ event_name: "pricing_viewed", anonymous_id: crypto.randomUUID(), idempotency_key: crypto.randomUUID() })?.eventName).toBe("pricing_viewed");
    expect(parseProductEvent({ event_name: "made_up", anonymous_id: crypto.randomUUID(), idempotency_key: crypto.randomUUID() })).toBeNull();
    expect(parseProductEvent({ event_name: "pricing_viewed", anonymous_id: "email@example.com", idempotency_key: crypto.randomUUID() })).toBeNull();
  });

  it("validates SNS v2, exact topic and safe certificate URL without auto-confirming", () => {
    const valid = {
      Type: "Notification", MessageId: "m-1", TopicArn: "arn:aws:sns:us-east-1:123456789012:secwyn-ses",
      Message: "{}", Timestamp: new Date().toISOString(), SignatureVersion: "2", Signature: "c2ln",
      SigningCertURL: "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem",
    };
    expect(validateSnsEnvelope(valid, [valid.TopicArn])?.type).toBe("Notification");
    expect(validateSnsEnvelope({ ...valid, TopicArn: `${valid.TopicArn}-evil` }, [valid.TopicArn])).toBeNull();
    expect(validateSnsEnvelope({ ...valid, SigningCertURL: "https://evil.example/cert.pem" }, [valid.TopicArn])).toBeNull();
    expect(validateSnsEnvelope({ ...valid, SigningCertURL: "http://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem" }, [valid.TopicArn])).toBeNull();
    expect(validateSnsEnvelope({ ...valid, SignatureVersion: "1" }, [valid.TopicArn])).toBeNull();
    expect(validateSnsEnvelope({ ...valid, Signature: undefined }, [valid.TopicArn])).toBeNull();
    expect(validateSnsEnvelope({ ...valid, Type: "SubscriptionConfirmation" }, [valid.TopicArn])?.type).toBe("SubscriptionConfirmation");
  });
  it("performs real RSA-SHA256 verification over the SNS canonical string", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const envelope = {
      type: "Notification" as const, messageId: "m-real", topicArn: "arn:aws:sns:us-east-1:123456789012:secwyn-ses",
      message: "{}", timestamp: new Date().toISOString(), signature: "", signingCertUrl: "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem",
    };
    envelope.signature = sign("RSA-SHA256", Buffer.from(snsCanonicalString(envelope)), privateKey).toString("base64");
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(verifySnsSignatureWithPem(envelope, pem)).toBe(true);
    expect(verifySnsSignatureWithPem({ ...envelope, message: "tampered" }, pem)).toBe(false);
  });

  it("stores unknown SES types safely without creating suppressions", () => {
    const unknown = parseSesNotification({ eventType: "FutureEvent", mail: { messageId: "ses-2", timestamp: new Date().toISOString(), destination: [] } });
    expect(unknown?.eventType).toBe("unknown");
    expect(suppressionReasonForEvent(unknown!.eventType)).toBeNull();
  });
  it("uses the real SES container timestamp and recognizes rendering/subscription events", () => {
    const mail = { messageId: "ses-3", timestamp: "2026-01-01T00:00:00.000Z", destination: [] };
    expect(parseSesNotification({ eventType: "Rendering Failure", mail, renderingFailure: { timestamp: "2026-01-02T00:00:00.000Z" } })?.eventType).toBe("rendering_failure");
    expect(parseSesNotification({ eventType: "Subscription", mail, subscription: { timestamp: "2026-01-03T00:00:00.000Z", subscriptionType: "OptOut" } })?.eventType).toBe("unsubscribe");
  });
  it("recognizes official SES subscription opt-out and rendering failure shapes", () => {
    const mail = { messageId: "ses-official", timestamp: "2026-01-01T00:00:00.000Z", destination: [] };
    const optedOut = parseSesNotification({ eventType: "Subscription", mail, subscription: { timestamp: "2026-01-03T00:00:00.000Z", newTopicPreferences: { unsubscribeAll: true } } });
    const optedIn = parseSesNotification({ eventType: "Subscription", mail, subscription: { topicSubscriptionStatus: [{ subscriptionStatus: "OPT_IN" }] } });
    const rendering = parseSesNotification({ eventType: "Rendering Failure", mail, failure: { timestamp: "2026-01-04T00:00:00.000Z" } });
    expect(optedOut?.eventType).toBe("unsubscribe");
    expect(optedIn?.eventType).toBe("unknown");
    expect(rendering).toMatchObject({ eventType: "rendering_failure", occurredAt: "2026-01-04T00:00:00.000Z" });
  });
  it("recognizes the official nested SES topic opt-out and persists its suppression", async () => {
    const raw = {
      eventType: "Subscription",
      mail: { messageId: "ses-topic-optout", timestamp: "2026-01-05T00:00:00.000Z", destination: ["person@example.com"] },
      subscription: {
        timestamp: "2026-01-05T00:01:00.000Z",
        newTopicPreferences: {
          unsubscribeAll: false,
          topicSubscriptionStatus: [{ topicName: "SecwynMarketing", subscriptionStatus: "OptOut" }],
        },
      },
    };
    const parsed = parseSesNotification(raw);
    expect(parsed?.eventType).toBe("unsubscribe");
    let suppression: Record<string, unknown> | null = null;
    const fake = {
      from(table: string) {
        if (table === "outreach_messages") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
        if (table === "email_events") return { insert: async () => ({ error: null }) };
        if (table === "suppression_list") return { upsert: async (value: Record<string, unknown>) => { suppression = value; return { error: null }; } };
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;
    await recordSesEvent({
      supabase: fake, event: parsed!, snsMessageId: "sns-topic-optout",
      identitySecret: "identity-test-key-with-at-least-32-chars", safetyAutopause: false,
      hardBounceThreshold: 0.02, complaintThreshold: 0.0005,
    });
    expect(suppression).toMatchObject({ reason: "unsubscribe", permanent: true });
  });
  it("deduplicates SNS retries while preserving distinct open/click notifications", () => {
    expect(sesDedupKey("sns-1")).toBe(sesDedupKey("sns-1"));
    expect(sesDedupKey("sns-open-1")).not.toBe(sesDedupKey("sns-open-2"));
  });

  it("parses SES events and permanently suppresses only hard bounce, complaint, unsubscribe", () => {
    const base = { mail: { messageId: "ses-1", timestamp: new Date().toISOString(), destination: ["person@example.com"] } };
    expect(parseSesNotification({ ...base, eventType: "Bounce", bounce: { bounceType: "Permanent" } })?.eventType).toBe("hard_bounce");
    expect(suppressionReasonForEvent("hard_bounce")).toBe("hard_bounce");
    expect(suppressionReasonForEvent("complaint")).toBe("complaint");
    expect(suppressionReasonForEvent("unsubscribe")).toBe("unsubscribe");
    expect(suppressionReasonForEvent("soft_bounce")).toBeNull();
  });
});

describe("E8 integration contracts", () => {
  it("keeps E8 sidecars best-effort and Creem metadata feature-gated", () => {
    const checkout = readFileSync("src/app/api/create-checkout/route.ts", "utf8");
    const webhook = readFileSync("src/app/api/payment/webhook/route.ts", "utf8");
    const creem = readFileSync("src/lib/e8/creem.ts", "utf8");
    expect(creem).toContain("if (!flags.observability) return null");
    expect(checkout).toContain("buildCreemCheckoutMetadata");
    expect(creem).toContain("checkout_request_id");
    expect(webhook).toMatch(/recordSubscriptionEvent[\s\S]*catch \{/);
    expect(webhook).toContain("grantSubscriptionCycle");
    expect(webhook).toContain("markReferralFirstPayment");
  });

  it("never auto-confirms SNS and preserves UTM while removing cid", () => {
    const snsRoute = readFileSync("src/app/api/e8/ses/events/route.ts", "utf8");
    const observer = readFileSync("src/components/e8/AttributionObserver.tsx", "utf8");
    expect(snsRoute).toContain('confirmation: "manual_required"');
    expect(snsRoute).not.toContain("SubscribeURL");
    expect(observer).toContain('url.searchParams.delete("cid")');
    expect(observer).not.toContain('url.searchParams.delete("utm_');
    expect(observer).not.toContain('trackE8Event("ses_click"');
  });

  it("keeps protected Secwyn credit, referral, bulk, Sheets and risk boundaries untouched", () => {
    const agents = readFileSync("AGENTS.md", "utf8");
    const sheets = readFileSync("google-sheets-addon/Code.gs", "utf8");
    const bulk = readFileSync("src/app/api/bulk-check/route.ts", "utf8");
    expect(agents).toContain("0-25/26-65/66-100");
    expect(agents).toContain("DNS cache TTL = 7 days");
    expect(sheets).toContain("x-api-key");
    expect(bulk).toContain("5000");
  });

  it("gates the read-only dashboard with both the flag and existing admin allowlist", () => {
    const dashboard = readFileSync("src/app/admin/e8/page.tsx", "utf8");
    expect(dashboard).toContain("if (!flags.dashboard) notFound()");
    expect(dashboard).toContain("isAdminEmail(user.email)");
    expect(dashboard).not.toMatch(/export async function POST/);
    expect(dashboard).toContain("No campaign data.");
    expect(dashboard).toContain("No anomaly data.");
    expect(dashboard).toContain('"subscription_paid_unclassified"');
    expect(dashboard).toContain("Needs review");
  });

  it("replays suppression and autopause after an earlier SES side-effect failure", async () => {
    let emailInsertCalls = 0;
    let suppressionCalls = 0;
    let countCalls = 0;
    let pauseCalls = 0;
    const countValues = [98, 2, 100, 0];
    const countChain = (count: number) => {
      const chain = {
        eq: () => chain,
        gte: () => chain,
        then: (resolve: (value: unknown) => void) => resolve({ count, error: null }),
      };
      return chain;
    };
    const fake = {
      from(table: string) {
        if (table === "outreach_messages") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
        if (table === "email_events") return {
          insert: async () => ({ error: emailInsertCalls++ === 0 ? null : { code: "23505" } }),
          select: () => countChain(countValues[countCalls++] ?? 0),
        };
        if (table === "suppression_list") return {
          upsert: async () => ({ error: suppressionCalls++ === 0 ? new Error("suppression failed") : null }),
        };
        if (table === "outreach_campaigns") return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "550e8400-e29b-41d4-a716-446655440000" }, error: null }) }) }),
          update: () => ({ eq: () => ({ eq: async () => { pauseCalls += 1; return { error: null }; } }) }),
        };
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;
    const input = {
      supabase: fake,
      event: {
        eventType: "hard_bounce" as const, providerMessageId: "ses-message", occurredAt: new Date().toISOString(),
        destinations: ["person@example.com"], recipientDomain: "example.com", bounceType: "Permanent" as const,
        bounceSubtype: "General", complaintType: null, batchId: "batch-1", raw: { mail: { tags: { campaign_id: ["550e8400-e29b-41d4-a716-446655440000"] } } },
      },
      snsMessageId: "sns-replay-id", identitySecret: "identity-test-key-with-at-least-32-chars",
      safetyAutopause: true, hardBounceThreshold: 0.02, complaintThreshold: 0.0005,
    };
    await expect(recordSesEvent(input)).rejects.toThrow("suppression failed");
    const result = await recordSesEvent(input);
    expect(result).toEqual({ duplicate: true });
    expect(suppressionCalls).toBe(2);
    expect(countCalls).toBe(4);
    expect(pauseCalls).toBe(1);
  });

  it("nulls a stale campaign tag before storing the SES event without losing raw evidence", async () => {
    const staleCampaignId = "550e8400-e29b-41d4-a716-446655440099";
    const raw = { mail: { tags: { campaign_id: [staleCampaignId] } } };
    let inserted: Record<string, unknown> | null = null;
    const fake = {
      from(table: string) {
        if (table === "outreach_messages") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
        if (table === "outreach_campaigns") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
        if (table === "email_events") return { insert: async (value: Record<string, unknown>) => { inserted = value; return { error: null }; } };
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;
    await recordSesEvent({
      supabase: fake,
      event: { eventType: "delivery", providerMessageId: "ses-stale-campaign", occurredAt: new Date().toISOString(), destinations: [], recipientDomain: null, bounceType: null, bounceSubtype: null, complaintType: null, batchId: null, raw },
      snsMessageId: "sns-stale-campaign", identitySecret: "identity-test-key-with-at-least-32-chars",
      safetyAutopause: false, hardBounceThreshold: 0.02, complaintThreshold: 0.0005,
    });
    expect(inserted).toMatchObject({ campaign_id: null, raw_payload: raw });
  });

  it("fails the observability sidecar closed on autopause count-query errors", async () => {
    let emailCalls = 0;
    const countChain = (error: unknown) => {
      const chain = {
        eq: () => chain,
        gte: () => chain,
        then: (resolve: (value: unknown) => void) => resolve({ count: 0, error }),
      };
      return chain;
    };
    const fake = {
      from(table: string) {
        if (table === "outreach_messages") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
        if (table === "email_events") {
          emailCalls += 1;
          if (emailCalls === 1) return { insert: async () => ({ error: null }) };
          return { select: () => countChain(emailCalls === 2 ? new Error("count failed") : null) };
        }
        if (table === "outreach_campaigns") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "550e8400-e29b-41d4-a716-446655440000" }, error: null }) }) }) };
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;
    await expect(recordSesEvent({
      supabase: fake,
      event: { eventType: "delivery", providerMessageId: "ses-message", occurredAt: new Date().toISOString(), destinations: [], recipientDomain: null, bounceType: null, bounceSubtype: null, complaintType: null, batchId: "batch-1", raw: { mail: { tags: { campaign_id: ["550e8400-e29b-41d4-a716-446655440000"] } } } },
      snsMessageId: "sns-new-id", identitySecret: "identity-test-key-with-at-least-32-chars", safetyAutopause: true,
      hardBounceThreshold: 0.02, complaintThreshold: 0.0005,
    })).rejects.toThrow("count failed");
  });

  it("reads nested Creem subscription metadata into nullable reconciliation fields", async () => {
    let inserted: Record<string, unknown> | null = null;
    const fake = {
      from(table: string) {
        if (table !== "subscription_events") throw new Error(`unexpected table ${table}`);
        return { upsert: async (value: Record<string, unknown>) => { inserted = value; return { error: null }; } };
      },
    } as unknown as SupabaseClient;
    await recordSubscriptionEvent({
      supabase: fake,
      rawBody: "signed-raw-body",
      event: { id: "evt-1", object: { subscription: { id: "sub-1", metadata: { user_id: "550e8400-e29b-41d4-a716-446655440000", plan: "growth", billing_interval: "yearly" } } } },
      eventType: "checkout.completed",
    });
    expect(inserted).toMatchObject({ user_id: "550e8400-e29b-41d4-a716-446655440000", plan: "growth", billing_interval: "yearly", provider_event_id: "evt-1" });
  });

  it("classifies nested Creem renewals from subscription dates even when the event timestamp is newer", async () => {
    let inserted: Record<string, unknown> | null = null;
    const fake = {
      from(table: string) {
        if (table !== "subscription_events") throw new Error(`unexpected table ${table}`);
        return { upsert: async (value: Record<string, unknown>) => { inserted = value; return { error: null }; } };
      },
    } as unknown as SupabaseClient;
    await recordSubscriptionEvent({
      supabase: fake,
      rawBody: "renewal-before-first-delivery",
      eventType: "subscription.paid",
      event: {
        id: "evt-renewal",
        object: {
          created_at: "2026-02-01T00:00:00Z",
          subscription: {
            id: "sub-renewal",
            created_at: "2026-01-01T00:00:00Z",
            current_period_start_date: "2026-02-01T00:00:00Z",
          },
        },
      },
    });
    expect(inserted).toMatchObject({ event_type: "renewal", reconciliation_status: "unmatched" });
  });

  it("keeps recovery untouched and bulk activation after one successful merge", () => {
    const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");
    const signup = readFileSync("src/app/(auth)/signup/page.tsx", "utf8");
    const bulkClient = readFileSync("src/app/(dashboard)/bulk-check/page.tsx", "utf8");
    const bulkServer = readFileSync("src/app/api/bulk-check/route.ts", "utf8");
    const observer = readFileSync("src/components/e8/AttributionObserver.tsx", "utf8");
    expect(callback).toContain('type === "recovery" ? "/reset-password"');
    expect(callback).toContain('type === "signup" || type === "email"');
    expect(signup).toContain('trackE8Event("signup_verification_pending"');
    expect(signup).not.toContain('trackE8Event("signup_completed"');
    expect((bulkClient.match(/trackE8Event\("bulk_check_completed"/g) || [])).toHaveLength(1);
    expect((bulkClient.match(/trackE8Event\("activation_completed"/g) || [])).toHaveLength(1);
    expect(bulkServer).not.toContain("recordActivationBestEffort");
    expect(observer).toContain("if (!observerMounted) return");
    expect(bulkClient).not.toContain("secwyn_e8_activation_session");
    expect(bulkClient).toMatch(/try \{[\s\S]*trackE8Event\("bulk_check_completed"[\s\S]*catch/);
  });

  it("adds fail-open single-audit product hooks without touching the API route", () => {
    const page = readFileSync("src/app/(dashboard)/risk-check/page.tsx", "utf8");
    expect(page).toContain('trackE8Event("free_audit_started"');
    expect(page).toContain('trackE8Event("contact_check_completed"');
    expect(page).toContain('trackE8Event("free_audit_completed"');
    expect(page).toContain('trackE8Event("report_viewed"');
    expect(page).toContain('trackE8Event("activation_completed"');
  });

  it("binds public product events to the signed anonymous cookie and matching attribution row", () => {
    const route = readFileSync("src/app/api/e8/product-events/route.ts", "utf8");
    expect(route).toContain("verifyAnonymousSession");
    expect(route).toContain('.eq("anonymous_id", anonymous.anonymousId)');
    expect(route).toContain("data.user_id !== user?.id");
    expect(route).toContain("isSameOrigin");
    expect(route).toContain("allowE8Request");
    expect(route).toContain("canonicalActivationKey");
  });

  it("validates CID message relationships and never reuses raw cid material in browser idempotency", () => {
    const route = readFileSync("src/app/api/e8/attribution/session/route.ts", "utf8");
    const repository = readFileSync("src/lib/e8/repository.ts", "utf8");
    const observer = readFileSync("src/components/e8/AttributionObserver.tsx", "utf8");
    expect(route).toContain("message.campaign_id !== cid.campaignId");
    expect(route).toContain("message.prospect_id !== cid.prospectId");
    expect(route).toContain("prospectId: cid?.prospectId");
    expect(route).toContain("messageId: cid?.outreachMessageId");
    expect(repository).toContain("prospect_id: params.prospectId");
    expect(repository).toContain("message_id: params.messageId");
    expect(observer).toContain("landing:cid:${safeLandingKey}");
    expect(observer).not.toContain("landing:cid:${cid}");
    expect(observer).not.toContain("sessionStorage.getItem(\"secwyn_e8_activation_session\")");
    expect(observer).toContain("const pathKey = url.pathname.slice(0, 64).replace");
    expect(observer).not.toContain("landing:organic:${browserSession}:${url.pathname}");
  });
});

describe("E8 migration contract", () => {
  it("creates exactly the eight additive tables with RLS and service-role-only grants", () => {
    const files = readdirSync("supabase/migrations")
      .filter((file) => file.endsWith("_e8_observability_backbone.sql"))
      .map((file) => `supabase/migrations/${file}`);
    expect(files).toHaveLength(1);
    const sql = readFileSync(files[0], "utf8").toLowerCase();
    const tables = ["outreach_campaigns", "outreach_prospects", "outreach_messages", "email_events", "acquisition_attribution", "product_events", "subscription_events", "suppression_list"];
    for (const table of tables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toMatch(new RegExp(`grant select, insert(?:, update)? on public\\.${table} to service_role`));
    }
    expect(sql).toContain("unique (source, idempotency_key)");
    expect(sql).toContain("revoke all on");
    expect(sql).toContain("purge_e8_expired_raw_payloads");
    expect(sql).toContain("raw_payload_expires_at");
    expect(sql).not.toContain("grant select, insert, update, delete on public.email_events");
    expect(sql).not.toContain("grant select, insert, update, delete on public.subscription_events");
    expect(sql).toContain("grant select, insert on public.email_events to service_role");
    expect(sql).toContain("grant select, insert on public.subscription_events to service_role");
    expect(sql).not.toContain("grant select, insert, update on public.email_events to service_role");
    expect(sql).not.toContain("grant select, insert, update on public.subscription_events to service_role");
    for (const index of ["idx_e8_message_prospect", "idx_e8_attribution_prospect", "idx_e8_attribution_message", "idx_e8_product_attribution", "idx_e8_product_user", "idx_e8_product_prospect", "idx_e8_product_message", "idx_e8_subscription_user", "idx_e8_subscription_attribution", "idx_e8_subscription_referral", "idx_e8_email_raw_expiry", "idx_e8_subscription_raw_expiry"]) {
      expect(sql).toContain(index);
    }
  });
});
