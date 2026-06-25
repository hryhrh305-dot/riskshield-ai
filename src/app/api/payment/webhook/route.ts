import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPlanRank } from "@/lib/plans";
import {
  findCreemProductById,
  findPlanByCreemProductId,
  getCreemPriceForPlan,
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
    .select("user_id, plan, provider_product_id")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();

  return data;
}

function extractCustomerId(event: any): string | null {
  return (
    event?.object?.customer_id ||
    event?.object?.customer?.id ||
    event?.object?.customer?.customer_id ||
    event?.object?.subscription?.customer_id ||
    event?.object?.subscription?.customer?.id ||
    event?.customer_id ||
    null
  );
}

async function updateProfileCustomerId(userId: string, customerId: string | null | undefined) {
  if (!customerId) return;

  await getSupabaseAdmin()
    .from("profiles")
    .update({
      creem_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

async function upsertSubscriptionRecord(params: {
  userId: string;
  plan: string;
  subscriptionId: string;
  status: string;
  customerId?: string | null;
  productId?: string | null;
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
    provider_customer_id: params.customerId || null,
    provider_subscription_id: params.subscriptionId,
    provider_product_id: params.productId || null,
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

async function updatePaymentCheckoutContext(params: {
  checkoutId?: string | null;
  subscriptionId?: string | null;
  productId?: string | null;
}) {
  if (!params.checkoutId) return;

  const payload: Record<string, unknown> = {};
  if (params.subscriptionId) payload.provider_subscription_id = params.subscriptionId;
  if (params.productId) payload.provider_product_id = params.productId;
  if (!Object.keys(payload).length) return;

  await getSupabaseAdmin()
    .from("payments")
    .update(payload)
    .eq("provider_checkout_id", params.checkoutId);
}

async function upsertProfileForPaidSubscription(params: {
  userId: string;
  plan: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  customerId?: string | null;
}) {
  const credits = getCreditsForPlan(params.plan);
  const { data: currentProfile } = await getSupabaseAdmin()
    .from("profiles")
    .select("plan, credits_remaining, creem_customer_id")
    .eq("id", params.userId)
    .maybeSingle();

  const currentPlan = currentProfile?.plan || "free";
  const shouldUpgrade = getPlanRank(params.plan) >= getPlanRank(currentPlan);
  const customerId = params.customerId || currentProfile?.creem_customer_id || null;

  const payload: Record<string, unknown> = {
    plan: shouldUpgrade ? params.plan : currentPlan,
    subscription_status: "active",
    subscription_start: asIso(params.currentPeriodStart) || new Date().toISOString(),
    subscription_end: asIso(params.currentPeriodEnd),
    credits_remaining: shouldUpgrade ? credits : currentProfile?.credits_remaining ?? credits,
    updated_at: new Date().toISOString(),
  };

  if (customerId) {
    payload.creem_customer_id = customerId;
  }

  await getSupabaseAdmin().from("profiles").update(payload).eq("id", params.userId);
}

async function updateProfileSubscriptionState(params: {
  userId: string;
  status: "active" | "cancelled" | "expired" | "past_due" | "paused";
  plan?: string;
  subscriptionEnd?: string | null;
  customerId?: string | null;
}) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    subscription_end: asIso(params.subscriptionEnd),
  };

  payload.subscription_status = params.status;

  if (params.plan) payload.plan = params.plan;
  if (params.customerId) payload.creem_customer_id = params.customerId;

  await getSupabaseAdmin().from("profiles").update(payload).eq("id", params.userId);
}

function extractEventType(event: any): string {
  return event?.eventType || event?.type || "";
}

function logWebhookEvent(level: "info" | "warn", label: string, eventType: string, event: any) {
  const logger = level === "warn" ? console.warn : console.info;
  logger(label, {
    eventType,
    payload: event,
  });
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
    findPlanByCreemProductId(productId || stored?.provider_product_id) ||
    null;

  return { userId, plan, subscriptionId, productId: productId || stored?.provider_product_id || null };
}

function extractPaymentIdentifiers(event: any) {
  return {
    checkoutId: event?.object?.checkout_id || event?.object?.checkout?.id || null,
    orderId: event?.object?.order?.id || event?.object?.order_id || null,
    transactionId:
      event?.object?.transaction_id ||
      event?.object?.last_transaction_id ||
      event?.object?.payment?.id ||
      null,
  };
}

async function updatePaymentStatusByIdentifiers(
  status: "refunded" | "failed",
  identifiers: { checkoutId?: string | null; orderId?: string | null; transactionId?: string | null },
) {
  const admin = getSupabaseAdmin();
  const queryTargets = [
    identifiers.transactionId ? { column: "provider_transaction_id", value: identifiers.transactionId } : null,
    identifiers.checkoutId ? { column: "provider_checkout_id", value: identifiers.checkoutId } : null,
    identifiers.orderId ? { column: "provider_transaction_id", value: identifiers.orderId } : null,
  ].filter(Boolean) as Array<{ column: "provider_transaction_id" | "provider_checkout_id"; value: string }>;

  for (const target of queryTargets) {
    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .eq(target.column, target.value)
      .maybeSingle();

    if (existing?.id) {
      await admin
        .from("payments")
        .update({
          status,
          provider_transaction_id: identifiers.transactionId || null,
        })
        .eq("id", existing.id);
      return true;
    }
  }

  return false;
}

async function findPaymentRecordByIdentifiers(identifiers: {
  checkoutId?: string | null;
  orderId?: string | null;
  transactionId?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const queryTargets = [
    identifiers.transactionId ? { column: "provider_transaction_id", value: identifiers.transactionId } : null,
    identifiers.checkoutId ? { column: "provider_checkout_id", value: identifiers.checkoutId } : null,
    identifiers.orderId ? { column: "provider_transaction_id", value: identifiers.orderId } : null,
  ].filter(Boolean) as Array<{ column: "provider_transaction_id" | "provider_checkout_id"; value: string }>;

  for (const target of queryTargets) {
    const { data: paymentRow } = await admin
      .from("payments")
      .select("id, user_id, provider_subscription_id, provider_product_id, plan")
      .eq(target.column, target.value)
      .maybeSingle();

    if (paymentRow?.id) {
      return paymentRow;
    }
  }

  return null;
}

async function updateMatchedSubscriptionState(params: {
  userId: string;
  subscriptionId?: string | null;
  subscriptionStatus: "cancelled" | "paused";
  productId?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  if (params.subscriptionId) {
    await admin
      .from("subscriptions")
      .update({
        status: params.subscriptionStatus,
        current_period_end: nowIso,
        cancelled_at: nowIso,
      })
      .eq("user_id", params.userId)
      .eq("provider_subscription_id", params.subscriptionId);
    return;
  }

  const { data: latestSubscription } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", params.userId)
    .eq("provider_product_id", params.productId || "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSubscription?.id) return;

  await admin
    .from("subscriptions")
    .update({
      status: params.subscriptionStatus,
      current_period_end: nowIso,
      cancelled_at: nowIso,
    })
    .eq("id", latestSubscription.id);
}

async function revokePaidAccessForBillingIssue(params: {
  userId: string;
  subscriptionId?: string | null;
  productId?: string | null;
  customerId?: string | null;
  profileStatus: "cancelled" | "paused";
  subscriptionStatus: "cancelled" | "paused";
}) {
  const freeCredits = getCreditsForPlan("free");
  const nowIso = new Date().toISOString();

  await updateMatchedSubscriptionState({
    userId: params.userId,
    subscriptionId: params.subscriptionId,
    subscriptionStatus: params.subscriptionStatus,
    productId: params.productId,
  });

  await getSupabaseAdmin()
    .from("profiles")
    .update({
      plan: "free",
      subscription_status: params.profileStatus,
      subscription_end: nowIso,
      credits_remaining: freeCredits,
      ...(params.customerId ? { creem_customer_id: params.customerId } : {}),
      updated_at: nowIso,
    })
    .eq("id", params.userId);
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
        const productId = event?.object?.product?.id || event?.object?.order?.product || null;
        const currentPeriodStart = event?.object?.subscription?.created_at || null;
        const currentPeriodEnd = event?.object?.subscription?.current_period_end_date || null;
        const customerId = extractCustomerId(event);

        if (checkoutId) {
          await markCheckoutPaymentCompleted(checkoutId, orderId);
          await updatePaymentCheckoutContext({
            checkoutId,
            subscriptionId,
            productId,
          });
        }

        if (userId && customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        if (userId && plan && subscriptionId) {
          await upsertSubscriptionRecord({
            userId,
            plan,
            subscriptionId,
            status: event?.object?.subscription?.status || "active",
            customerId,
            productId,
            currentPeriodStart,
            currentPeriodEnd,
            cancelledAt: event?.object?.subscription?.canceled_at || null,
          });
        }
        break;
      }

      case "subscription.active": {
        const { userId, plan, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (userId && plan && subscriptionId) {
          if (customerId) {
            await updateProfileCustomerId(userId, customerId);
          }

          await upsertSubscriptionRecord({
            userId,
            plan,
            subscriptionId,
            status: "active",
            customerId,
            productId,
            currentPeriodStart: event?.object?.current_period_start_date || event?.object?.created_at || null,
            currentPeriodEnd: event?.object?.current_period_end_date || null,
            cancelledAt: event?.object?.canceled_at || null,
          });

          await upsertProfileForPaidSubscription({
            userId,
            plan,
            currentPeriodStart: event?.object?.current_period_start_date || event?.object?.created_at || null,
            currentPeriodEnd: event?.object?.current_period_end_date || null,
            customerId,
          });
        }
        break;
      }

      case "subscription.paid": {
        const { userId, plan, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !plan || !subscriptionId) break;

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        await upsertSubscriptionRecord({
          userId,
          plan,
          subscriptionId,
          status: "active",
          customerId,
          productId,
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || null,
        });

        await upsertProfileForPaidSubscription({
          userId,
          plan,
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          customerId,
        });

        const transactionId = event?.object?.last_transaction_id || null;
        if (transactionId) {
          const productMatch = findCreemProductById(productId);
          const { data: existingPayment } = await getSupabaseAdmin()
            .from("payments")
            .select("id")
            .eq("provider_transaction_id", transactionId)
            .maybeSingle();

          if (!existingPayment) {
            await getSupabaseAdmin().from("payments").insert({
              user_id: userId,
              provider: "creem",
              provider_subscription_id: subscriptionId,
              provider_transaction_id: transactionId,
              provider_product_id: productId,
              amount: getCreemPriceForPlan(plan, productMatch?.billingInterval || "monthly"),
              currency: event?.object?.product?.currency || "USD",
              status: "completed",
              plan,
            });
          } else {
            await getSupabaseAdmin()
              .from("payments")
              .update({
                provider_subscription_id: subscriptionId,
                provider_product_id: productId,
              })
              .eq("id", existingPayment.id);
          }
        }
        break;
      }

      case "subscription.update": {
        const { userId, plan, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !subscriptionId) break;

        const subscriptionStatus = (event?.object?.status || "active") as "active" | "cancelled" | "expired" | "past_due" | "paused";

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        await upsertSubscriptionRecord({
          userId,
          plan: plan || "free",
          subscriptionId,
          status: subscriptionStatus,
          customerId,
          productId,
          currentPeriodStart: event?.object?.current_period_start_date || event?.object?.created_at || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || null,
        });

        if (subscriptionStatus === "active") {
          await upsertProfileForPaidSubscription({
            userId,
            plan: plan || "free",
            currentPeriodStart: event?.object?.current_period_start_date || null,
            currentPeriodEnd: event?.object?.current_period_end_date || null,
            customerId,
          });
        } else {
          await updateProfileSubscriptionState({
            userId,
            status: subscriptionStatus,
            plan: plan || undefined,
            subscriptionEnd: event?.object?.current_period_end_date || event?.object?.canceled_at || null,
            customerId,
          });
        }
        break;
      }

      case "subscription.canceled": {
        const { userId, plan, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !subscriptionId) break;

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        await upsertSubscriptionRecord({
          userId,
          plan: plan || "free",
          subscriptionId,
          status: "cancelled",
          customerId,
          productId,
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || new Date().toISOString(),
        });

        await updateProfileSubscriptionState({
          userId,
          status: "cancelled",
          plan: "free",
          subscriptionEnd: event?.object?.current_period_end_date || event?.object?.canceled_at || null,
          customerId,
        });
        break;
      }

      case "subscription.scheduled_cancel": {
        const { userId, plan, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !subscriptionId) break;

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        await upsertSubscriptionRecord({
          userId,
          plan: plan || "free",
          subscriptionId,
          status: "active",
          customerId,
          productId,
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || new Date().toISOString(),
        });

        await upsertProfileForPaidSubscription({
          userId,
          plan: plan || "free",
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || event?.object?.canceled_at || null,
          customerId,
        });
        break;
      }

      case "subscription.unpaid": {
        const { userId, plan, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !subscriptionId) break;

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        await upsertSubscriptionRecord({
          userId,
          plan: plan || "free",
          subscriptionId,
          status: "past_due",
          customerId,
          productId,
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || null,
        });

        await updateProfileSubscriptionState({
          userId,
          status: "past_due",
          plan: plan || undefined,
          subscriptionEnd: event?.object?.current_period_end_date || null,
          customerId,
        });
        break;
      }

      case "subscription.past_due": {
        const { userId, plan, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !subscriptionId) break;

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        await upsertSubscriptionRecord({
          userId,
          plan: plan || "free",
          subscriptionId,
          status: "past_due",
          customerId,
          productId,
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || null,
        });

        await updateProfileSubscriptionState({
          userId,
          status: "past_due",
          subscriptionEnd: event?.object?.current_period_end_date || null,
          customerId,
        });
        break;
      }

      case "subscription.paused": {
        const { userId, plan, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !subscriptionId) break;

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        await upsertSubscriptionRecord({
          userId,
          plan: plan || "free",
          subscriptionId,
          status: "paused",
          customerId,
          productId,
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || null,
        });

        await updateProfileSubscriptionState({
          userId,
          status: "paused",
          plan: "free",
          subscriptionEnd: event?.object?.current_period_end_date || null,
          customerId,
        });
        break;
      }

      case "refund.created": {
        const identifiers = extractPaymentIdentifiers(event);
        const updated = await updatePaymentStatusByIdentifiers("refunded", identifiers);
        const paymentRow = await findPaymentRecordByIdentifiers(identifiers);
        const customerId = extractCustomerId(event);

        if (paymentRow?.user_id) {
          await revokePaidAccessForBillingIssue({
            userId: paymentRow.user_id,
            subscriptionId: paymentRow.provider_subscription_id,
            productId: paymentRow.provider_product_id,
            customerId,
            profileStatus: "cancelled",
            subscriptionStatus: "cancelled",
          });
        }

        logWebhookEvent(
          "info",
          updated ? "[creem-webhook][refund.created][applied]" : "[creem-webhook][refund.created][unmatched]",
          eventType,
          event,
        );
        break;
      }

      case "dispute.created": {
        const identifiers = extractPaymentIdentifiers(event);
        const updated = await updatePaymentStatusByIdentifiers("failed", identifiers);
        const paymentRow = await findPaymentRecordByIdentifiers(identifiers);
        const customerId = extractCustomerId(event);

        if (paymentRow?.user_id) {
          await revokePaidAccessForBillingIssue({
            userId: paymentRow.user_id,
            subscriptionId: paymentRow.provider_subscription_id,
            productId: paymentRow.provider_product_id,
            customerId,
            profileStatus: "paused",
            subscriptionStatus: "paused",
          });
        }

        logWebhookEvent(
          "warn",
          updated ? "[creem-webhook][dispute.created][applied]" : "[creem-webhook][dispute.created][unmatched]",
          eventType,
          event,
        );
        break;
      }

      case "subscription.expired": {
        const { userId, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !subscriptionId) break;

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        await upsertSubscriptionRecord({
          userId,
          plan: "free",
          subscriptionId,
          status: "expired",
          customerId,
          productId,
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || null,
        });

        await updateProfileSubscriptionState({
          userId,
          status: "expired",
          plan: "free",
          subscriptionEnd: null,
          customerId,
        });
        break;
      }

      default: {
        logWebhookEvent("info", "[creem-webhook][ignored]", eventType || "unknown", event);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
