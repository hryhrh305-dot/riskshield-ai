import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { plans, type PlanKey } from "@/lib/plans";
import {
  findPlanByCreemProductId,
  getCreditsForPlan,
  verifyCreemWebhookSignature,
} from "@/lib/creem";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET || "";

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseAdmin;
}

function asIso(value: string | null | undefined): string | null {
  return value || null;
}

async function getStoredSubscription(subscriptionId: string | null | undefined) {
  if (!subscriptionId) return null;

  const { data } = await getSupabaseAdmin()
    .from("subscriptions")
    .select("user_id, plan")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();

  return data;
}

async function upsertSubscriptionRecord(params: {
  userId: string;
  plan: string;
  subscriptionId: string;
  status: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelledAt?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("provider_subscription_id", params.subscriptionId)
    .maybeSingle();

  const payload = {
    user_id: params.userId,
    payment_provider: "creem",
    provider_subscription_id: params.subscriptionId,
    plan: params.plan,
    status: params.status,
    current_period_start: asIso(params.currentPeriodStart),
    current_period_end: asIso(params.currentPeriodEnd),
    cancelled_at: asIso(params.cancelledAt),
  };

  if (existing?.id) {
    await admin.from("subscriptions").update(payload).eq("id", existing.id);
    return;
  }

  await admin.from("subscriptions").insert(payload);
}

async function markCheckoutPaymentCompleted(checkoutId: string | null | undefined, orderId?: string | null) {
  if (!checkoutId) return;

  await getSupabaseAdmin()
    .from("payments")
    .update({
      status: "completed",
      provider_transaction_id: orderId || null,
    })
    .eq("provider_checkout_id", checkoutId);
}

async function upsertProfileForPaidSubscription(params: {
  userId: string;
  plan: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}) {
  const credits = getCreditsForPlan(params.plan);

  await getSupabaseAdmin()
    .from("profiles")
    .update({
      plan: params.plan,
      subscription_status: "active",
      subscription_start: asIso(params.currentPeriodStart) || new Date().toISOString(),
      subscription_end: asIso(params.currentPeriodEnd),
      credits_remaining: credits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.userId);
}

async function updateProfileSubscriptionState(params: {
  userId: string;
  status: "active" | "cancelled" | "expired" | "past_due";
  plan?: string;
  subscriptionEnd?: string | null;
}) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    subscription_end: asIso(params.subscriptionEnd),
  };

  if (params.status === "past_due") {
    payload.subscription_status = "past_due";
  } else {
    payload.subscription_status = params.status;
  }

  if (params.plan) payload.plan = params.plan;

  await getSupabaseAdmin().from("profiles").update(payload).eq("id", params.userId);
}

function extractEventType(event: any): string {
  return event?.eventType || event?.type || "";
}

function extractCheckoutUserAndPlan(event: any) {
  const metadata = event?.object?.metadata || {};
  const subscriptionMetadata = event?.object?.subscription?.metadata || {};
  const productId = event?.object?.product?.id || event?.object?.order?.product || null;

  const userId =
    metadata.user_id ||
    metadata.userId ||
    metadata.referenceId ||
    subscriptionMetadata.user_id ||
    subscriptionMetadata.userId ||
    subscriptionMetadata.referenceId ||
    null;

  const plan =
    metadata.plan ||
    subscriptionMetadata.plan ||
    findPlanByCreemProductId(productId) ||
    null;

  return { userId, plan };
}

async function resolveSubscriptionContext(event: any) {
  const metadata = event?.object?.metadata || {};
  const productId = event?.object?.product?.id || null;
  const subscriptionId = event?.object?.id || event?.object?.subscription?.id || null;
  const stored = await getStoredSubscription(subscriptionId);

  const userId =
    metadata.user_id ||
    metadata.userId ||
    metadata.referenceId ||
    stored?.user_id ||
    null;

  const plan =
    metadata.plan ||
    stored?.plan ||
    findPlanByCreemProductId(productId) ||
    null;

  return { userId, plan, subscriptionId };
}

export async function POST(req: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CREEM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
    }

    const payload = await req.text();
    const signature =
      req.headers.get("creem-signature") ||
      req.headers.get("x-creem-signature") ||
      "";

    if (!verifyCreemWebhookSignature(payload, signature, CREEM_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(payload);
    const eventType = extractEventType(event);

    switch (eventType) {
      case "checkout.completed": {
        const { userId, plan } = extractCheckoutUserAndPlan(event);
        const subscriptionId = event?.object?.subscription?.id || null;
        const checkoutId = event?.object?.id || null;
        const orderId = event?.object?.order?.id || null;
        const currentPeriodStart = event?.object?.subscription?.created_at || null;
        const currentPeriodEnd = event?.object?.subscription?.current_period_end_date || null;

        if (checkoutId) {
          await markCheckoutPaymentCompleted(checkoutId, orderId);
        }

        if (userId && plan && subscriptionId) {
          await upsertSubscriptionRecord({
            userId,
            plan,
            subscriptionId,
            status: event?.object?.subscription?.status || "active",
            currentPeriodStart,
            currentPeriodEnd,
            cancelledAt: event?.object?.subscription?.canceled_at || null,
          });
        }
        break;
      }

      case "subscription.active": {
        const { userId, plan, subscriptionId } = await resolveSubscriptionContext(event);
        if (userId && plan && subscriptionId) {
          await upsertSubscriptionRecord({
            userId,
            plan,
            subscriptionId,
            status: "active",
            currentPeriodStart: event?.object?.current_period_start_date || event?.object?.created_at || null,
            currentPeriodEnd: event?.object?.current_period_end_date || null,
            cancelledAt: event?.object?.canceled_at || null,
          });
        }
        break;
      }

      case "subscription.paid": {
        const { userId, plan, subscriptionId } = await resolveSubscriptionContext(event);
        if (!userId || !plan || !subscriptionId) break;

        await upsertSubscriptionRecord({
          userId,
          plan,
          subscriptionId,
          status: "active",
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || null,
        });

        await upsertProfileForPaidSubscription({
          userId,
          plan,
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
        });

        const transactionId = event?.object?.last_transaction_id || null;
        if (transactionId) {
          const { data: existingPayment } = await getSupabaseAdmin()
            .from("payments")
            .select("id")
            .eq("provider_transaction_id", transactionId)
            .maybeSingle();

          if (!existingPayment) {
            await getSupabaseAdmin().from("payments").insert({
              user_id: userId,
              provider: "creem",
              provider_transaction_id: transactionId,
              amount: plans[plan as PlanKey]?.price ?? null,
              currency: event?.object?.product?.currency || "USD",
              status: "completed",
              plan,
            });
          }
        }
        break;
      }

      case "subscription.canceled":
      case "subscription.scheduled_cancel": {
        const { userId, plan, subscriptionId } = await resolveSubscriptionContext(event);
        if (!userId || !subscriptionId) break;

        await upsertSubscriptionRecord({
          userId,
          plan: plan || "free",
          subscriptionId,
          status: eventType === "subscription.canceled" ? "cancelled" : "active",
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || new Date().toISOString(),
        });

        await updateProfileSubscriptionState({
          userId,
          status: "cancelled",
          subscriptionEnd: event?.object?.current_period_end_date || event?.object?.canceled_at || null,
        });
        break;
      }

      case "subscription.past_due": {
        const { userId, plan, subscriptionId } = await resolveSubscriptionContext(event);
        if (!userId || !subscriptionId) break;

        await upsertSubscriptionRecord({
          userId,
          plan: plan || "free",
          subscriptionId,
          status: "past_due",
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || null,
        });

        await updateProfileSubscriptionState({
          userId,
          status: "past_due",
          subscriptionEnd: event?.object?.current_period_end_date || null,
        });
        break;
      }

      case "subscription.expired": {
        const { userId, subscriptionId } = await resolveSubscriptionContext(event);
        if (!userId || !subscriptionId) break;

        await upsertSubscriptionRecord({
          userId,
          plan: "free",
          subscriptionId,
          status: "expired",
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || null,
        });

        await updateProfileSubscriptionState({
          userId,
          status: "expired",
          plan: "free",
          subscriptionEnd: null,
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
