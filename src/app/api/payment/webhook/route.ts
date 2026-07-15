import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  type CreemWebhookEvent,
  BILLING_REVOKE_EVENTS,
  CREEM_HANDLED_EVENT_TYPES,
  classifyCreemRefund,
  extractCustomerId,
  extractEventType,
  extractPaymentIdentifiers,
  getBillingLookupCandidates,
} from "@/lib/creem-webhook";
import {
  findCreemProductById,
  findPlanByCreemProductId,
  getCreemApiBaseUrl,
  verifyCreemWebhookSignature,
} from "@/lib/creem";
import { markReferralFirstPayment } from "@/lib/referral-rewards";
import { grantSubscriptionCycle, revokeSubscriptionTransactionCredits } from "@/lib/subscription-credits";
import { getE8Flags } from "@/lib/e8/flags";
import { safeE8ErrorCode } from "@/lib/e8/creem";
import { recordSubscriptionEvent } from "@/lib/e8/repository";
import { findBillingCatalogEntryByProductId } from "@/lib/billing-catalog";

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
  if (productMatch && productMatch.plan !== params.plan) throw new Error("SUBSCRIPTION_PRODUCT_PLAN_MISMATCH");
  const paidEventAnchor = params.establishAnchor ? asIso(params.currentPeriodStart) : null;
  const anchor = productMatch?.billingInterval === "yearly" && paidEventAnchor
    ? paidEventAnchor
    : existing?.credit_anchor_at || paidEventAnchor;

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

function minorUnitsToMajor(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount / 100 : null;
}

async function markCheckoutPaymentCompleted(
  checkoutId: string | null | undefined,
  order?: Record<string, unknown> | null,
) {
  if (!checkoutId) return;

  const transactionId = typeof order?.transaction === "string" ? order.transaction : null;
  const amount = minorUnitsToMajor(order?.amount_paid ?? order?.amount_due ?? order?.amount);
  const currency = typeof order?.currency === "string" ? order.currency : null;
  const payload: Record<string, unknown> = { status: "completed" };
  if (amount !== null) payload.amount = amount;
  if (currency) payload.currency = currency;

  if (transactionId) {
    const { data: transactionPayment, error: transactionLookupError } = await getSupabaseAdmin()
      .from("payments")
      .select("id")
      .eq("provider", "creem")
      .eq("provider_transaction_id", transactionId)
      .maybeSingle();
    if (transactionLookupError) throw transactionLookupError;
    if (transactionPayment?.id) {
      const { error: linkError } = await getSupabaseAdmin()
        .from("payments")
        .update({ ...payload, provider_checkout_id: checkoutId })
        .eq("id", transactionPayment.id);
      if (linkError) throw linkError;
      const { error: deleteError } = await getSupabaseAdmin()
        .from("payments")
        .delete()
        .eq("provider_checkout_id", checkoutId)
        .neq("id", transactionPayment.id)
        .eq("status", "pending");
      if (deleteError) throw deleteError;
      return;
    }
  }

  const { error } = await getSupabaseAdmin()
    .from("payments")
    .update(payload)
    .eq("provider_checkout_id", checkoutId);
  if (error) throw error;
}

type CreemTransactionSnapshot = {
  amount: number | null;
  currency: string | null;
};

async function getCreemTransactionSnapshot(
  transactionId: string,
  subscriptionId: string,
): Promise<CreemTransactionSnapshot | null> {
  const apiKey = process.env.CREEM_API_KEY || "";
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `${getCreemApiBaseUrl(apiKey)}/transactions?transaction_id=${encodeURIComponent(transactionId)}`,
      { headers: { "x-api-key": apiKey }, cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return null;
    const data = await response.json() as Record<string, unknown>;
    if (data.id !== transactionId || (data.subscription && data.subscription !== subscriptionId)) return null;
    if (data.status !== "paid") return null;
    return {
      amount: minorUnitsToMajor(data.amount_paid),
      currency: typeof data.currency === "string" ? data.currency : null,
    };
  } catch {
    return null;
  }
}

async function registerCompletedPayment(params: {
  userId: string;
  plan: string;
  subscriptionId: string;
  transactionId: string;
  productId?: string | null;
  currency?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const snapshot = await getCreemTransactionSnapshot(params.transactionId, params.subscriptionId);
  const { data: existing, error: existingError } = await admin.from("payments")
    .select("id,status").eq("provider_transaction_id", params.transactionId).maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "refunded" || existing?.status === "failed") {
    return { id: existing.id as string, terminal: true };
  }

  const updatePayload: Record<string, unknown> = {
    provider_subscription_id: params.subscriptionId,
    provider_transaction_id: params.transactionId,
    provider_product_id: params.productId || null,
    status: "completed",
    plan: params.plan,
  };
  if (snapshot?.amount !== null && snapshot?.amount !== undefined) updatePayload.amount = snapshot.amount;
  if (snapshot?.currency || params.currency) updatePayload.currency = snapshot?.currency || params.currency;

  if (existing?.id) {
    const { error } = await admin.from("payments").update(updatePayload).eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id as string, terminal: false };
  }

  const unboundQuery = admin.from("payments")
    .select("id")
    .eq("user_id", params.userId)
    .eq("provider", "creem")
    .eq("provider_subscription_id", params.subscriptionId)
    .is("provider_transaction_id", null)
    .in("status", ["pending", "completed"])
    .order("created_at", { ascending: true })
    .limit(1);
  const unboundResult = await unboundQuery.maybeSingle();
  let unbound = unboundResult.data;
  if (unboundResult.error) throw unboundResult.error;

  if (!unbound && params.productId) {
    const pendingResult = await admin.from("payments")
      .select("id")
      .eq("user_id", params.userId)
      .eq("provider", "creem")
      .eq("provider_product_id", params.productId)
      .is("provider_transaction_id", null)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingResult.error) throw pendingResult.error;
    unbound = pendingResult.data;
  }

  if (unbound?.id) {
    const { error } = await admin.from("payments").update(updatePayload).eq("id", unbound.id);
    if (error) throw error;
    return { id: unbound.id as string, terminal: false };
  }

  const { data: inserted, error: insertError } = await admin.from("payments").insert({
    user_id: params.userId,
    provider: "creem",
    ...updatePayload,
    amount: snapshot?.amount ?? null,
    currency: snapshot?.currency || params.currency || "USD",
  }).select("id").single();
  if (insertError) throw insertError;
  return { id: inserted.id as string, terminal: false };
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
        const { userId } = extractCheckoutUserAndPlan(event);
        const subscriptionId = event?.object?.subscription?.id || null;
        const checkoutId = event?.object?.id || null;
        const order = event?.object?.order && typeof event.object.order === "object"
          ? event.object.order as Record<string, unknown>
          : null;
        const productId = event?.object?.product?.id || event?.object?.order?.product || null;
        const customerId = extractCustomerId(event);

        if (checkoutId) {
          await markCheckoutPaymentCompleted(checkoutId, order);
          await updatePaymentCheckoutContext({
            checkoutId,
            subscriptionId,
            productId,
          });
        }

        if (userId && customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        break;
      }

      case "subscription.active": {
        const { userId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (userId && customerId) {
          await updateProfileCustomerId(userId, customerId);
        }
        break;
      }

      case "subscription.paid": {
        const { userId, plan, subscriptionId, productId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !plan || !subscriptionId) break;
        const transactionId = typeof event?.object?.last_transaction_id === "string"
          ? event.object.last_transaction_id
          : null;
        if (!transactionId) throw new Error("SUBSCRIPTION_PAYMENT_TRANSACTION_REQUIRED");
        const payment = await registerCompletedPayment({
          userId,
          plan,
          subscriptionId,
          transactionId,
          productId,
          currency: typeof event?.object?.product?.currency === "string"
            ? event.object.product.currency
            : null,
        });
        if (payment.terminal) {
          console.warn("[creem-webhook][stale-paid-after-terminal]", {
            subscriptionId,
            transactionPresent: true,
          });
          break;
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
        const catalogEntry = findBillingCatalogEntryByProductId(productId);
        if (!catalogEntry) throw new Error("UNKNOWN_SUBSCRIPTION_PRODUCT");
        await grantSubscriptionCycle({
          supabase: getSupabaseAdmin(), userId, subscriptionId, plan, anchor: creditAnchor, at: paidAt,
          paidThrough: event?.object?.current_period_end_date || "",
          providerTransactionId: transactionId,
          generation: catalogEntry.generation,
          billingInterval: catalogEntry.interval,
        });

        if (payment.id) {
          await markReferralFirstPayment({
            supabase: getSupabaseAdmin(),
            referredUserId: userId,
            plan,
            paymentId: payment.id,
            paidAt: event?.object?.current_period_start_date || undefined,
            generation: catalogEntry.generation,
            billingInterval: catalogEntry.interval,
          });
        }
        break;
      }

      case "subscription.update": {
        const { userId, subscriptionId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !subscriptionId) break;

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
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
        const { userId, subscriptionId } = await resolveSubscriptionContext(event);
        const customerId = extractCustomerId(event);
        if (!userId || !subscriptionId) break;

        if (customerId) {
          await updateProfileCustomerId(userId, customerId);
        }

        const { error } = await getSupabaseAdmin()
          .from("subscriptions")
          .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("provider_subscription_id", subscriptionId);
        if (error) throw error;
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
        const refund = classifyCreemRefund(event);
        const identifiers = extractPaymentIdentifiers(event);
        if (refund.kind === "unverified") {
          throw new Error("UNVERIFIED_REFUND_EVENT");
        }
        if (refund.kind === "partial") {
          logWebhookEvent("info", "[creem-webhook][refund.created][partial-recorded]", eventType, event);
          break;
        }

        const billingSubject = await findBillingSubjectFromWebhookEvent(event);
        const subscriptionId = billingSubject?.providerSubscriptionId || identifiers.subscriptionId;
        if (
          !billingSubject?.userId || !billingSubject.paymentId || !subscriptionId ||
          !refund.transactionId || !refund.refundId
        ) {
          throw new Error("REFUND_TRANSACTION_GRANT_CONTEXT_REQUIRED");
        }
        await revokeSubscriptionTransactionCredits({
          supabase: getSupabaseAdmin(),
          userId: billingSubject.userId,
          subscriptionId,
          providerTransactionId: refund.transactionId,
          reversalRef: refund.refundId,
          reason: typeof event?.object?.reason === "string" ? event.object.reason : "refund",
          terminalStatus: "cancelled",
        });
        await disqualifyPendingReferral(billingSubject.paymentId);

        logWebhookEvent(
          "info",
          `[creem-webhook][refund.created][applied:${billingSubject.source}]`,
          eventType,
          event,
        );
        break;
      }

      case "dispute.created": {
        const identifiers = extractPaymentIdentifiers(event);
        const billingSubject = await findBillingSubjectFromWebhookEvent(event);
        const subscriptionId = billingSubject?.providerSubscriptionId || identifiers.subscriptionId;
        const reversalRef = typeof event?.object?.id === "string" ? event.object.id : null;
        if (
          !billingSubject?.userId || !billingSubject.paymentId || !subscriptionId ||
          !identifiers.transactionId || !reversalRef
        ) {
          throw new Error("DISPUTE_TRANSACTION_GRANT_CONTEXT_REQUIRED");
        }
        await revokeSubscriptionTransactionCredits({
          supabase: getSupabaseAdmin(),
          userId: billingSubject.userId,
          subscriptionId,
          providerTransactionId: identifiers.transactionId,
          reversalRef,
          reason: "dispute",
          terminalStatus: "paused",
        });
        await disqualifyPendingReferral(billingSubject.paymentId);

        logWebhookEvent(
          "warn",
          `[creem-webhook][dispute.created][applied:${billingSubject.source}]`,
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

    if (getE8Flags().observability) {
      after(async () => {
        try {
          await Promise.race([
            recordSubscriptionEvent({ supabase: getSupabaseAdmin(), rawBody: payload, event: event as unknown as Record<string, unknown>, eventType: eventType || "unknown" }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("E8_TIMEOUT")), 500)),
          ]);
        } catch (error) {
          console.warn("[e8-creem][subscription-sidecar-failed]", {
            eventType: eventType || "unknown",
            code: safeE8ErrorCode(error),
          });
        }
      });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
