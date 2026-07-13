import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  type CreemWebhookEvent,
  BILLING_REVOKE_EVENTS,
  CREEM_HANDLED_EVENT_TYPES,
  extractCustomerId,
  extractEventType,
  extractPaymentIdentifiers,
  getBillingLookupCandidates,
} from "@/lib/creem-webhook";
import {
  findCreemProductById,
  findPlanByCreemProductId,
  getCreemPriceForPlan,
  verifyCreemWebhookSignature,
} from "@/lib/creem";
import { markReferralFirstPayment } from "@/lib/referral-rewards";
import { grantSubscriptionCycle, revokeSubscriptionCredits } from "@/lib/subscription-credits";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || "";
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

  const { data, error } = await getSupabaseAdmin()
    .from("subscriptions")
    .select("user_id, plan, provider_product_id")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw error;

  return data;
}

async function updateProfileCustomerId(userId: string, customerId: string | null | undefined) {
  if (!customerId) return;

  const { error } = await getSupabaseAdmin()
    .from("profiles")
    .update({
      creem_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
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
  establishAnchor?: boolean;
  cancelAtPeriodEnd?: boolean;
}) {
  const admin = getSupabaseAdmin();
  const { data: existing, error: lookupError } = await admin
    .from("subscriptions")
    .select("id, credit_anchor_at")
    .eq("provider_subscription_id", params.subscriptionId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  const productMatch = findCreemProductById(params.productId);
  if (params.establishAnchor && !productMatch) throw new Error("UNKNOWN_SUBSCRIPTION_PRODUCT");
  const anchor = existing?.credit_anchor_at || (params.establishAnchor ? asIso(params.currentPeriodStart) : null);

  const payload: Record<string, unknown> = {
    user_id: params.userId,
    payment_provider: "creem",
    provider_subscription_id: params.subscriptionId,
    plan: params.plan,
    status: params.status,
    updated_at: new Date().toISOString(),
  };
  if (params.customerId) payload.provider_customer_id=params.customerId;
  if (params.productId) payload.provider_product_id=params.productId;
  if (params.currentPeriodStart) payload.current_period_start=asIso(params.currentPeriodStart);
  if (params.currentPeriodEnd) payload.current_period_end=asIso(params.currentPeriodEnd);
  if (params.cancelledAt) payload.cancelled_at=asIso(params.cancelledAt);
  if (productMatch) payload.billing_interval=productMatch.billingInterval;
  if (anchor) payload.credit_anchor_at=anchor;
  if (params.establishAnchor && params.currentPeriodEnd) payload.paid_through=asIso(params.currentPeriodEnd);
  if (params.cancelAtPeriodEnd!==undefined) payload.cancel_at_period_end=params.cancelAtPeriodEnd;
  if (params.status!=="active") payload.billing_terminal_at=new Date().toISOString();

  if (existing?.id) {
    const { error } = await admin.from("subscriptions").update(payload).eq("id", existing.id);
    if (error) throw error;
    return anchor;
  }

  const { error } = await admin.from("subscriptions").insert(payload);
  if (error) throw error;
  return anchor;
}

async function markCheckoutPaymentCompleted(checkoutId: string | null | undefined, orderId?: string | null) {
  if (!checkoutId) return;

  const { error } = await getSupabaseAdmin()
    .from("payments")
    .update({
      status: "completed",
      provider_transaction_id: orderId || null,
    })
    .eq("provider_checkout_id", checkoutId);
  if (error) throw error;
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

  const { error } = await getSupabaseAdmin()
    .from("payments")
    .update(payload)
    .eq("provider_checkout_id", params.checkoutId);
  if (error) throw error;
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

  const { error } = await getSupabaseAdmin().from("profiles").update(payload).eq("id", params.userId);
  if (error) throw error;
}

function logWebhookEvent(level: "info" | "warn", label: string, eventType: string, event: CreemWebhookEvent) {
  const logger = level === "warn" ? console.warn : console.info;
  const identifiers = extractPaymentIdentifiers(event);
  logger(label, {
    eventType,
    subscriptionId: identifiers.subscriptionId || null,
    checkoutPresent: Boolean(identifiers.checkoutId),
    transactionPresent: Boolean(identifiers.transactionId),
  });
}

function extractCheckoutUserAndPlan(event: CreemWebhookEvent) {
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

async function resolveSubscriptionContext(event: CreemWebhookEvent) {
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
    const { data: existing, error: lookupError } = await admin
      .from("payments")
      .select("id")
      .eq(target.column, target.value)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing?.id) {
      const { error } = await admin
        .from("payments")
        .update({
          status,
          provider_transaction_id: identifiers.transactionId || null,
        })
        .eq("id", existing.id);
      if (error) throw error;
      return true;
    }
  }

  return false;
}

type BillingSubjectMatch = {
  userId: string;
  source:
    | "payment.provider_transaction_id"
    | "payment.provider_checkout_id"
    | "payment.provider_subscription_id"
    | "subscription.provider_subscription_id"
    | "profile.creem_customer_id"
    | "subscription.provider_customer_id"
    | "metadata.user_id"
    | "metadata.profile_id";
  paymentId?: string | null;
  providerSubscriptionId?: string | null;
  providerProductId?: string | null;
  customerId?: string | null;
};

async function findBillingSubjectFromWebhookEvent(event: CreemWebhookEvent): Promise<BillingSubjectMatch | null> {
  const admin = getSupabaseAdmin();
  const identifiers = extractPaymentIdentifiers(event);
  const candidates = getBillingLookupCandidates(event);

  for (const candidate of candidates) {
    if (candidate.kind === "transaction") {
      const { data } = await admin
        .from("payments")
        .select("id, user_id, provider_subscription_id, provider_product_id")
        .eq("provider_transaction_id", candidate.value)
        .maybeSingle();

      if (data?.user_id) {
        return {
          userId: data.user_id,
          source: "payment.provider_transaction_id",
          paymentId: data.id,
          providerSubscriptionId: data.provider_subscription_id,
          providerProductId: data.provider_product_id,
          customerId: identifiers.customerId,
        };
      }
    }

    if (candidate.kind === "checkout") {
      const { data } = await admin
        .from("payments")
        .select("id, user_id, provider_subscription_id, provider_product_id")
        .eq("provider_checkout_id", candidate.value)
        .maybeSingle();

      if (data?.user_id) {
        return {
          userId: data.user_id,
          source: "payment.provider_checkout_id",
          paymentId: data.id,
          providerSubscriptionId: data.provider_subscription_id,
          providerProductId: data.provider_product_id,
          customerId: identifiers.customerId,
        };
      }
    }

    if (candidate.kind === "subscription") {
      const { data: paymentData } = await admin
        .from("payments")
        .select("id, user_id, provider_subscription_id, provider_product_id")
        .eq("provider_subscription_id", candidate.value)
        .maybeSingle();

      if (paymentData?.user_id) {
        return {
          userId: paymentData.user_id,
          source: "payment.provider_subscription_id",
          paymentId: paymentData.id,
          providerSubscriptionId: paymentData.provider_subscription_id,
          providerProductId: paymentData.provider_product_id,
          customerId: identifiers.customerId,
        };
      }

      const { data: subscriptionData } = await admin
        .from("subscriptions")
        .select("user_id, provider_subscription_id, provider_product_id, provider_customer_id")
        .eq("provider_subscription_id", candidate.value)
        .maybeSingle();

      if (subscriptionData?.user_id) {
        return {
          userId: subscriptionData.user_id,
          source: "subscription.provider_subscription_id",
          providerSubscriptionId: subscriptionData.provider_subscription_id,
          providerProductId: subscriptionData.provider_product_id,
          customerId: subscriptionData.provider_customer_id || identifiers.customerId,
        };
      }
    }

    if (candidate.kind === "customer") {
      const { data: profileData } = await admin
        .from("profiles")
        .select("id")
        .eq("creem_customer_id", candidate.value)
        .maybeSingle();

      if (profileData?.id) {
        return {
          userId: profileData.id,
          source: "profile.creem_customer_id",
          customerId: candidate.value,
        };
      }

      const { data: subscriptionData } = await admin
        .from("subscriptions")
        .select("user_id, provider_subscription_id, provider_product_id, provider_customer_id")
        .eq("provider_customer_id", candidate.value)
        .maybeSingle();

      if (subscriptionData?.user_id) {
        return {
          userId: subscriptionData.user_id,
          source: "subscription.provider_customer_id",
          providerSubscriptionId: subscriptionData.provider_subscription_id,
          providerProductId: subscriptionData.provider_product_id,
          customerId: subscriptionData.provider_customer_id,
        };
      }
    }

    if (candidate.kind === "user") {
      return {
        userId: candidate.value,
        source: "metadata.user_id",
        providerSubscriptionId: identifiers.subscriptionId,
        customerId: identifiers.customerId,
      };
    }

    if (candidate.kind === "profile") {
      return {
        userId: candidate.value,
        source: "metadata.profile_id",
        providerSubscriptionId: identifiers.subscriptionId,
        customerId: identifiers.customerId,
      };
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
    const { error } = await admin
      .from("subscriptions")
      .update({
        status: params.subscriptionStatus,
        current_period_end: nowIso,
        cancelled_at: nowIso,
        billing_terminal_at: nowIso,
        cancel_at_period_end: false,
      })
      .eq("user_id", params.userId)
      .eq("provider_subscription_id", params.subscriptionId);
    if (error) throw error;
    return;
  }

  const { data: latestSubscription, error: lookupError } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", params.userId)
    .eq("provider_product_id", params.productId || "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (!latestSubscription?.id) return;

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: params.subscriptionStatus,
      current_period_end: nowIso,
      cancelled_at: nowIso,
      billing_terminal_at: nowIso,
      cancel_at_period_end: false,
    })
    .eq("id", latestSubscription.id);
  if (error) throw error;
}

async function revokePaidAccessForBillingIssue(params: {
  userId: string;
  subscriptionId?: string | null;
  productId?: string | null;
  customerId?: string | null;
  profileStatus: "cancelled" | "paused";
  subscriptionStatus: "cancelled" | "paused";
}) {
  if (!params.subscriptionId) throw new Error("BILLING_REVERSAL_SUBSCRIPTION_REQUIRED");

  await revokeSubscriptionCredits({
    supabase: getSupabaseAdmin(), userId: params.userId,
    subscriptionId: params.subscriptionId, reason: params.profileStatus, terminalStatus: params.subscriptionStatus,
  });
}

async function disqualifyPendingReferral(paymentId:string|null|undefined) {
  if(!paymentId) return;
  const {error}=await getSupabaseAdmin().from("referral_attributions").update({
    reward_status:"disqualified",reward_notes:"First payment was refunded, disputed, or reversed.",updated_at:new Date().toISOString(),
  }).eq("reward_payment_id",paymentId).in("reward_status",["pending_review","manual_review"]);
  if(error) throw error;
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

    const event = JSON.parse(payload) as CreemWebhookEvent;
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

        }
        break;
      }

      case "subscription.paid": {
        const { userId, plan, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !plan || !subscriptionId) break;
        const transactionId = event?.object?.last_transaction_id || null;
        if (transactionId) {
          const { data: priorPayment, error: priorPaymentError } = await getSupabaseAdmin().from("payments")
            .select("id,status").eq("provider_transaction_id", transactionId).maybeSingle();
          if (priorPaymentError) throw priorPaymentError;
          if (priorPayment?.status === "refunded" || priorPayment?.status === "failed") {
            console.warn("[creem-webhook][stale-paid-after-terminal]", { subscriptionId, transactionPresent: true });
            break;
          }
        }

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        const creditAnchor = await upsertSubscriptionRecord({
          userId,
          plan,
          subscriptionId,
          status: "active",
          customerId,
          productId,
          currentPeriodStart: event?.object?.current_period_start_date || null,
          currentPeriodEnd: event?.object?.current_period_end_date || null,
          cancelledAt: event?.object?.canceled_at || null,
          establishAnchor: true,
          cancelAtPeriodEnd: false,
        });

        const paidAt = event?.object?.current_period_start_date || creditAnchor;
        if (!creditAnchor || !paidAt) throw new Error("SUBSCRIPTION_CREDIT_ANCHOR_MISSING");
        await grantSubscriptionCycle({
          supabase: getSupabaseAdmin(), userId, subscriptionId, plan, anchor: creditAnchor, at: paidAt,
          paidThrough: event?.object?.current_period_end_date || "",
        });

        let referralPaymentId: string | null = null;
        if (transactionId) {
          const productMatch = findCreemProductById(productId);
          const { data: existingPayment, error: existingPaymentError } = await getSupabaseAdmin()
            .from("payments")
            .select("id")
            .eq("provider_transaction_id", transactionId)
            .maybeSingle();
          if (existingPaymentError) throw existingPaymentError;

          if (!existingPayment) {
            const { data: insertedPayment, error: insertedPaymentError } = await getSupabaseAdmin()
              .from("payments")
              .insert({
                user_id: userId,
                provider: "creem",
                provider_subscription_id: subscriptionId,
                provider_transaction_id: transactionId,
                provider_product_id: productId,
                amount: getCreemPriceForPlan(plan, productMatch?.billingInterval || "monthly"),
                currency: event?.object?.product?.currency || "USD",
                status: "completed",
                plan,
              })
              .select("id")
              .single();
            if (insertedPaymentError) throw insertedPaymentError;
            referralPaymentId = insertedPayment?.id || null;
          } else {
            referralPaymentId = existingPayment.id;
            const { error: paymentUpdateError } = await getSupabaseAdmin()
              .from("payments")
              .update({
                provider_subscription_id: subscriptionId,
                provider_product_id: productId,
              })
              .eq("id", existingPayment.id);
            if (paymentUpdateError) throw paymentUpdateError;
          }
        }
        if (referralPaymentId) {
          await markReferralFirstPayment({
            supabase: getSupabaseAdmin(),
            referredUserId: userId,
            plan,
            paymentId: referralPaymentId,
            paidAt: event?.object?.current_period_start_date || undefined,
          });
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
          await updateProfileSubscriptionState({ userId, status: "active", plan: plan || undefined,
            subscriptionEnd: event?.object?.current_period_end_date || null, customerId });
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
          cancelAtPeriodEnd: false,
        });

        await updateProfileSubscriptionState({
          userId,
          status: "cancelled",
          plan: plan || undefined,
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
          cancelAtPeriodEnd: true,
        });

        await updateProfileSubscriptionState({ userId, status: "active", plan: plan || undefined,
          subscriptionEnd: event?.object?.current_period_end_date || event?.object?.canceled_at || null, customerId });
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
        const billingSubject = await findBillingSubjectFromWebhookEvent(event);

        if (billingSubject?.userId) {
          await disqualifyPendingReferral(billingSubject.paymentId);
          await revokePaidAccessForBillingIssue({
            userId: billingSubject.userId,
            subscriptionId: billingSubject.providerSubscriptionId || identifiers.subscriptionId,
            productId: billingSubject.providerProductId,
            customerId: billingSubject.customerId,
            profileStatus: "cancelled",
            subscriptionStatus: "cancelled",
          });
        } else {
          console.warn("[creem-webhook][refund.created][unmatched-subject]", {
            eventType,
            candidates: getBillingLookupCandidates(event),
            metadataEmailPresent: Boolean(identifiers.metadataEmail),
          });
        }

        logWebhookEvent(
          "info",
          updated
            ? `[creem-webhook][refund.created][applied:${billingSubject?.source || "payment-only"}]`
            : "[creem-webhook][refund.created][unmatched-payment]",
          eventType,
          event,
        );
        break;
      }

      case "dispute.created": {
        const identifiers = extractPaymentIdentifiers(event);
        const updated = await updatePaymentStatusByIdentifiers("failed", identifiers);
        const billingSubject = await findBillingSubjectFromWebhookEvent(event);

        if (billingSubject?.userId) {
          await disqualifyPendingReferral(billingSubject.paymentId);
          await revokePaidAccessForBillingIssue({
            userId: billingSubject.userId,
            subscriptionId: billingSubject.providerSubscriptionId || identifiers.subscriptionId,
            productId: billingSubject.providerProductId,
            customerId: billingSubject.customerId,
            profileStatus: "paused",
            subscriptionStatus: "paused",
          });
        } else {
          console.warn("[creem-webhook][dispute.created][unmatched-subject]", {
            eventType,
            candidates: getBillingLookupCandidates(event),
            metadataEmailPresent: Boolean(identifiers.metadataEmail),
          });
        }

        logWebhookEvent(
          "warn",
          updated
            ? `[creem-webhook][dispute.created][applied:${billingSubject?.source || "payment-only"}]`
            : "[creem-webhook][dispute.created][unmatched-payment]",
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
        if (
          eventType &&
          !CREEM_HANDLED_EVENT_TYPES.includes(eventType as (typeof CREEM_HANDLED_EVENT_TYPES)[number]) &&
          !BILLING_REVOKE_EVENTS.includes(eventType as (typeof BILLING_REVOKE_EVENTS)[number])
        ) {
          console.info("[creem-webhook][unknown-event]", {
            eventType,
            candidates: getBillingLookupCandidates(event),
          });
        }
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
