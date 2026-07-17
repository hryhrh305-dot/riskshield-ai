import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminV2CanaryDecision } from "@/lib/admin-v2-canary";
import { verifyCreemWebhookSignature } from "@/lib/creem";
import { extractEventType, extractPaymentIdentifiers, type CreemWebhookEvent } from "@/lib/creem-webhook";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { findTestCanaryProductById } from "@/lib/test-canary-billing";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function eventMetadata(event: CreemWebhookEvent): JsonRecord {
  const object = record(event.object);
  const subscription = record(object.subscription);
  return { ...record(subscription.metadata), ...record(object.metadata) };
}

function eventProductId(event: CreemWebhookEvent): string | null {
  const object = record(event.object);
  const subscription = record(object.subscription);
  return stringValue(record(object.product).id)
    || stringValue(record(subscription.product).id)
    || stringValue(record(object.order).product)
    || stringValue(object.product_id);
}

function minorAmount(event: CreemWebhookEvent): number | null {
  const object = record(event.object);
  const transaction = record(object.transaction);
  const order = record(object.order);
  const raw = object.amount_paid ?? transaction.amount_paid ?? order.amount_paid ?? order.amount;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value / 100 : null;
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
    const eventType = extractEventType(event);
    const metadata = eventMetadata(event);
    const productId = eventProductId(event);
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

    const admin = getSupabaseAdminClient();
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(userId);
    const user = userResult?.user;
    const canary = getAdminV2CanaryDecision({ verified: !userError && Boolean(user?.email), email: user?.email || null }, process.env);
    if (!canary.enabled) {
      return NextResponse.json({ error: "Test Canary actor rejected." }, { status: 403 });
    }

    const object = record(event.object);
    const subscription = record(object.subscription);
    const customer = record(object.customer);
    const identifiers = extractPaymentIdentifiers(event);
    const periodStart = stringValue(object.current_period_start_date ?? subscription.current_period_start_date);
    const periodEnd = stringValue(object.current_period_end_date ?? subscription.current_period_end_date);
    const currency = stringValue(record(object.product).currency ?? object.currency ?? record(object.order).currency) || "USD";
    const amount = minorAmount(event);

    const { data, error } = await admin.rpc("process_test_canary_webhook_event", {
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload_hash: createHash("sha256").update(payload).digest("hex"),
      p_user_id: userId,
      p_checkout_id: identifiers.checkoutId,
      p_transaction_id: identifiers.transactionId,
      p_subscription_id: identifiers.subscriptionId,
      p_customer_id: identifiers.customerId || stringValue(customer.id),
      p_product_id: product.productId,
      p_correlation_id: correlationId,
      p_plan: product.plan,
      p_billing_interval: product.interval,
      p_amount: amount,
      p_currency: currency,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_monthly_credits: product.entry.monthlyCredits,
    });
    if (error) throw error;

    return NextResponse.json({ received: true, result: data });
  } catch (error) {
    console.error("[test-canary-webhook]", error instanceof Error ? error.message : "processing_failed");
    return NextResponse.json({ error: "Test Canary webhook failed." }, { status: 500 });
  }
}
