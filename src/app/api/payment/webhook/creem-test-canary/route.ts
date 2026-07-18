import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminV2CanaryDecision } from "@/lib/admin-v2-canary";
import { verifyCreemWebhookSignature } from "@/lib/creem";
import type { CreemWebhookEvent } from "@/lib/creem-webhook";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { findTestCanaryProductById } from "@/lib/test-canary-billing";
import { parseTestCanaryWebhookPayload } from "@/lib/test-canary-webhook-payload";

type JsonRecord = Record<string, unknown>;

const PROCESSABLE_TEST_EVENT_TYPES = new Set([
  "checkout.completed",
  "subscription.active",
  "subscription.paid",
  "subscription.update",
  "subscription.canceled",
  "subscription.scheduled_cancel",
  "subscription.past_due",
  "subscription.paused",
  "subscription.expired",
  "refund.created",
  "dispute.created",
]);

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeProcessingError(error: unknown): string {
  if (!error || typeof error !== "object") return "processing_failed";
  const message = stringValue((error as JsonRecord).message);
  const allowlisted = new Set([
    "TEST_CANARY_CHECKOUT_ID_REQUIRED",
    "INVALID_TEST_CANARY_PAID_EVENT",
    "TEST_CANARY_PENDING_PAYMENT_REQUIRED",
    "TEST_CANARY_SUBSCRIPTION_CONFLICT",
    "TEST_CANARY_GRANT_CONFLICT",
    "TEST_CANARY_EVENT_ID_PAYLOAD_CONFLICT",
    "INVALID_TEST_CANARY_WEBHOOK_CONTEXT",
  ]);
  return message && allowlisted.has(message) ? message : "processing_failed";
}

export async function POST(request: NextRequest) {
  const secret = process.env.CREEM_CANARY_TEST_WEBHOOK_SECRET || "";
  if (!secret) return NextResponse.json({ error: "Test Canary webhook is not configured." }, { status: 503 });

  const payload = await request.text();
  const signature = request.headers.get("creem-signature") || request.headers.get("x-creem-signature") || "";
  if (!verifyCreemWebhookSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: CreemWebhookEvent;
  try {
    event = JSON.parse(payload) as CreemWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const eventId = stringValue(event.id);
    const parsed = parseTestCanaryWebhookPayload(event);
    const eventType = parsed.eventType;
    const metadata = parsed.metadata;
    const productId = parsed.productId;
    const userId = stringValue(metadata.user_id);
    const correlationId = stringValue(metadata.correlation_id);
    const metadataEnvironment = stringValue(metadata.billing_environment);
    const metadataGeneration = stringValue(metadata.catalog_generation);
    const metadataPlan = stringValue(metadata.plan);
    const metadataInterval = stringValue(metadata.billing_interval);
    const product = findTestCanaryProductById(productId, process.env);

    if (!eventId || !userId || !correlationId || metadataEnvironment !== "test_canary"
      || metadataGeneration !== "premium_v2" || !product
      || product.plan !== metadataPlan || product.interval !== metadataInterval) {
      return NextResponse.json({ error: "Invalid Test Canary event context." }, { status: 400 });
    }

    if (!PROCESSABLE_TEST_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const admin = getSupabaseAdminClient();
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(userId);
    const user = userResult?.user;
    const canary = getAdminV2CanaryDecision({ verified: !userError && Boolean(user?.email), email: user?.email || null }, process.env);
    if (!canary.enabled) {
      return NextResponse.json({ error: "Test Canary actor rejected." }, { status: 403 });
    }

    const { data, error } = await admin.rpc("process_test_canary_webhook_event", {
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload_hash: createHash("sha256").update(payload).digest("hex"),
      p_user_id: userId,
      p_checkout_id: parsed.checkoutId,
      p_transaction_id: parsed.transactionId,
      p_subscription_id: parsed.subscriptionId,
      p_customer_id: parsed.customerId,
      p_product_id: product.productId,
      p_correlation_id: correlationId,
      p_plan: product.plan,
      p_billing_interval: product.interval,
      p_amount: parsed.amount,
      p_currency: parsed.currency,
      p_period_start: parsed.periodStart,
      p_period_end: parsed.periodEnd,
      p_monthly_credits: product.entry.monthlyCredits,
    });
    if (error) throw error;

    return NextResponse.json({ received: true, result: data });
  } catch (error) {
    console.error("[test-canary-webhook]", safeProcessingError(error));
    return NextResponse.json({ error: "Test Canary webhook failed." }, { status: 500 });
  }
}
