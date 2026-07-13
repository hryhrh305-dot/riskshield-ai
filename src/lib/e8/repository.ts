import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { hashEmail } from "./identity";
import type { ParsedProductEvent } from "./validation";
import type { ParsedSesEvent } from "./ses";
import { sesDedupKey, suppressionReasonForEvent } from "./ses";
import { classifyCreemSubscriptionPaid } from "./creem";

export async function recordAttribution(params: {
  supabase: SupabaseClient;
  anonymousId: string;
  userId?: string | null;
  campaignId?: string | null;
  prospectId?: string | null;
  messageId?: string | null;
  cidJti?: string | null;
  path?: string | null;
  utm?: Record<string, string | null>;
}) {
  const { data: existing, error: lookupError } = await params.supabase
    .from("acquisition_attribution")
    .select("id,campaign_id,prospect_id,message_id,cid_jti,anonymous_id,user_id,assisted_channels")
    .eq("anonymous_id", params.anonymousId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const update: Record<string, unknown> = { last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (!existing.user_id && params.userId) update.user_id = params.userId;
    if (!existing.campaign_id && params.campaignId) update.campaign_id = params.campaignId;
    if (!existing.cid_jti && params.cidJti) update.cid_jti = params.cidJti;
    if (!existing.prospect_id && params.prospectId) update.prospect_id = params.prospectId;
    if (!existing.message_id && params.messageId) update.message_id = params.messageId;
    const nonDirect = params.utm?.source && params.utm.source.toLowerCase() !== "direct" ? params.utm.source : null;
    if (nonDirect) {
      update.last_non_direct_source = nonDirect;
      update.last_non_direct_medium = params.utm?.medium || null;
      update.last_non_direct_campaign = params.utm?.campaign || null;
      update.assisted_channels = [...new Set([...(existing.assisted_channels || []), nonDirect])];
    }
    const { error } = await params.supabase.from("acquisition_attribution").update(update).eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id as string, campaign_id: existing.campaign_id as string | null, anonymous_id: existing.anonymous_id as string };
  }
  const payload = {
    anonymous_id: params.anonymousId,
    user_id: params.userId || null,
    campaign_id: params.campaignId || null,
    prospect_id: params.prospectId || null,
    message_id: params.messageId || null,
    cid_jti: params.cidJti || null,
    landing_path: params.path || null,
    first_utm_source: params.utm?.source || null,
    first_utm_medium: params.utm?.medium || null,
    first_utm_campaign: params.utm?.campaign || null,
    first_utm_content: params.utm?.content || null,
    first_utm_term: params.utm?.term || null,
    last_non_direct_source: params.utm?.source && params.utm.source.toLowerCase() !== "direct" ? params.utm.source : null,
    last_non_direct_medium: params.utm?.medium || null,
    last_non_direct_campaign: params.utm?.campaign || null,
    assisted_channels: params.utm?.source && params.utm.source.toLowerCase() !== "direct" ? [params.utm.source] : [],
    source: "web",
    idempotency_key: params.anonymousId,
    last_seen_at: new Date().toISOString(),
  };
  const { data, error } = await params.supabase
    .from("acquisition_attribution")
    .insert(payload)
    .select("id,campaign_id,anonymous_id")
    .single();
  if (error) {
    // A concurrent first request may have won the anonymous_id unique key.
    const { data: raced, error: raceError } = await params.supabase
      .from("acquisition_attribution")
      .select("id,campaign_id,anonymous_id")
      .eq("anonymous_id", params.anonymousId)
      .maybeSingle();
    if (raceError || !raced) throw error;
    return raced as { id: string; campaign_id: string | null; anonymous_id: string };
  }
  return data as { id: string; campaign_id: string | null; anonymous_id: string };
}

export async function recordProductEvent(params: {
  supabase: SupabaseClient;
  event: ParsedProductEvent;
  userId?: string | null;
  attributionId?: string | null;
  source?: string;
}) {
  let dimensions: Record<string, unknown> = {};
  if (params.attributionId) {
    const { data, error } = await params.supabase.from("acquisition_attribution")
      .select("campaign_id,prospect_id,message_id,first_utm_source,first_utm_medium,first_utm_campaign")
      .eq("id", params.attributionId).maybeSingle();
    if (error) throw error;
    if (data) dimensions = {
      campaign_id: data.campaign_id,
      prospect_id: data.prospect_id,
      message_id: data.message_id,
      utm_source: data.first_utm_source,
      utm_medium: data.first_utm_medium,
      utm_campaign: data.first_utm_campaign,
    };
    if (data?.message_id) {
      const { data: message, error: messageError } = await params.supabase.from("outreach_messages")
        .select("template_key,step_key,list_tier,country_code,source_keyword,provider")
        .eq("id", data.message_id).maybeSingle();
      if (messageError) throw messageError;
      if (message) dimensions = { ...dimensions, ...message };
    }
  }
  const { error } = await params.supabase.from("product_events").upsert({
    ...dimensions,
    attribution_id: params.attributionId || null,
    anonymous_id: params.event.anonymousId,
    user_id: params.userId || null,
    event_name: params.event.eventName,
    path: params.event.path,
    properties: params.event.properties,
    source: params.source || "web",
    idempotency_key: params.event.idempotencyKey,
  }, { onConflict: "source,idempotency_key", ignoreDuplicates: true });
  if (error) throw error;
}

function campaignIdFromSes(raw: Record<string, unknown>) {
  const mail = raw.mail as Record<string, unknown> | undefined;
  const tags = mail?.tags as Record<string, unknown> | undefined;
  const values = tags?.campaign_id;
  const value = Array.isArray(values) ? values[0] : values;
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function recordSesEvent(params: {
  supabase: SupabaseClient;
  event: ParsedSesEvent;
  snsMessageId: string;
  identitySecret: string;
  safetyAutopause: boolean;
  hardBounceThreshold: number;
  complaintThreshold: number;
}) {
  const taggedCampaignId = campaignIdFromSes(params.event.raw);
  const { data: linkedMessage, error: messageError } = await params.supabase.from("outreach_messages")
    .select("id,campaign_id,prospect_id,template_key,step_key,market,source_keyword,list_tier,country_code")
    .eq("provider", "ses").eq("provider_message_id", params.event.providerMessageId).maybeSingle();
  if (messageError) throw messageError;
  let campaignId = linkedMessage?.campaign_id || null;
  if (taggedCampaignId) {
    const { data: taggedCampaign, error: campaignError } = await params.supabase.from("outreach_campaigns")
      .select("id").eq("id", taggedCampaignId).maybeSingle();
    if (campaignError) throw campaignError;
    if (taggedCampaign?.id) campaignId = taggedCampaignId;
  }
  const identityHashes = [...new Set(params.event.destinations.map((email) => hashEmail(email, params.identitySecret)))];
  const identityHash = identityHashes[0] || null;
  const idempotencyKey = sesDedupKey(params.snsMessageId);
  const { error } = await params.supabase.from("email_events").insert({
    campaign_id: campaignId,
    message_id: linkedMessage?.id || null,
    prospect_id: linkedMessage?.prospect_id || null,
    provider: "ses",
    provider_message_id: params.event.providerMessageId,
    provider_event_id: params.snsMessageId,
    event_type: params.event.eventType,
    identity_hash: identityHash,
    recipient_domain: params.event.recipientDomain,
    bounce_type: params.event.bounceType,
    bounce_subtype: params.event.bounceSubtype,
    complaint_type: params.event.complaintType,
    batch_id: params.event.batchId,
    template_key: linkedMessage?.template_key || null,
    step_key: linkedMessage?.step_key || null,
    market: linkedMessage?.market || null,
    source_keyword: linkedMessage?.source_keyword || null,
    list_tier: linkedMessage?.list_tier || null,
    country_code: linkedMessage?.country_code || null,
    occurred_at: params.event.occurredAt,
    raw_payload: params.event.raw,
    payload_hash: createHash("sha256").update(JSON.stringify(params.event.raw)).digest("hex"),
    source: "aws_sns",
    idempotency_key: idempotencyKey,
  });
  const duplicate = Boolean(error && (error as { code?: string }).code === "23505");
  if (error && !duplicate) throw error;

  const reason = suppressionReasonForEvent(params.event.eventType);
  if (reason && identityHashes.length) {
    for (const recipientHash of identityHashes) {
      const { error: suppressionError } = await params.supabase.from("suppression_list").upsert({
        identity_hash: recipientHash,
        reason,
        provider: "ses",
        provider_message_id: params.event.providerMessageId,
        campaign_id: campaignId,
        template_key: linkedMessage?.template_key || null,
        step_key: linkedMessage?.step_key || null,
        list_tier: linkedMessage?.list_tier || null,
        country_code: linkedMessage?.country_code || null,
        source_keyword: linkedMessage?.source_keyword || null,
        permanent: true,
        source: "aws_sns",
        idempotency_key: `${reason}:${recipientHash}`,
      }, { onConflict: "identity_hash,reason", ignoreDuplicates: true });
      if (suppressionError) throw suppressionError;
    }
  }

  if (params.safetyAutopause && campaignId) {
    let delivered = 0;
    let hardBounces = 0;
    if (params.event.batchId) {
      const [deliveryResult, bounceResult] = await Promise.all([
        params.supabase.from("email_events").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("batch_id", params.event.batchId).eq("event_type", "delivery"),
        params.supabase.from("email_events").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("batch_id", params.event.batchId).eq("event_type", "hard_bounce"),
      ]);
      if (deliveryResult.error) throw deliveryResult.error;
      if (bounceResult.error) throw bounceResult.error;
      delivered = deliveryResult.count || 0;
      hardBounces = bounceResult.count || 0;
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [recentDeliveryResult, complaintResult] = await Promise.all([
      params.supabase.from("email_events").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("event_type", "delivery").gte("occurred_at", since),
      params.supabase.from("email_events").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("event_type", "complaint").gte("occurred_at", since),
    ]);
    if (recentDeliveryResult.error) throw recentDeliveryResult.error;
    if (complaintResult.error) throw complaintResult.error;
    const recentDeliveries = recentDeliveryResult.count || 0;
    const complaints = complaintResult.count || 0;
    const attempted = delivered + hardBounces;
    const hardRate = attempted ? hardBounces / attempted : 0;
    const complaintRate = recentDeliveries ? complaints / recentDeliveries : 0;
    const hardExceeded = Boolean(params.event.batchId) && attempted >= 100 && hardRate >= params.hardBounceThreshold;
    const complaintExceeded = recentDeliveries >= 100 && complaintRate >= params.complaintThreshold;
    if (hardExceeded || complaintExceeded) {
      const { error: pauseError } = await params.supabase.from("outreach_campaigns").update({
        status: "paused",
        safety_paused_at: new Date().toISOString(),
        safety_pause_reason: hardExceeded ? "hard_bounce_threshold" : "complaint_threshold_24h",
        updated_at: new Date().toISOString(),
      }).eq("id", campaignId).eq("status", "active");
      if (pauseError) throw pauseError;
    }
  }
  return { duplicate };
}

export async function recordSubscriptionEvent(params: {
  supabase: SupabaseClient;
  rawBody: string;
  event: Record<string, unknown>;
  eventType: string;
}) {
  const object = (params.event.object || {}) as Record<string, unknown>;
  const subscription = (object.subscription || {}) as Record<string, unknown>;
  const metadata = {
    ...((subscription.metadata || {}) as Record<string, unknown>),
    ...((object.metadata || {}) as Record<string, unknown>),
  };
  const eventId = typeof params.event.id === "string" ? params.event.id : null;
  const idempotencyKey = eventId || `creem-v1:${createHash("sha256").update(params.rawBody).digest("hex")}`;
  const userId = typeof metadata.user_id === "string" && /^[0-9a-f-]{36}$/i.test(metadata.user_id) ? metadata.user_id : null;
  const subscriptionId = typeof object.id === "string" && params.eventType.startsWith("subscription.")
    ? object.id
    : typeof subscription.id === "string" ? subscription.id : null;
  let normalizedEventType = params.eventType || "unknown";
  if (params.eventType === "subscription.paid") normalizedEventType = classifyCreemSubscriptionPaid({ ...object, ...subscription });
  else if (params.eventType === "refund.created") normalizedEventType = "refund";
  const customer = (object.customer || {}) as Record<string, unknown>;
  const order = (object.order || {}) as Record<string, unknown>;
  const numberOrNull = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const uuidOrNull = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  const attributionId = uuidOrNull(metadata.attribution_id);
  const campaignId = uuidOrNull(metadata.campaign_id);
  const messageId = uuidOrNull(metadata.outreach_message_id || metadata.message_id);
  const prospectId = uuidOrNull(metadata.prospect_id);
  let messageDimensions: Record<string, unknown> = {};
  if (messageId) {
    const { data: message, error: messageError } = await params.supabase.from("outreach_messages")
      .select("campaign_id,prospect_id,template_key,step_key,list_tier,country_code,source_keyword,market")
      .eq("id", messageId).maybeSingle();
    if (messageError) throw messageError;
    if (message) messageDimensions = message;
  }
  const gross = numberOrNull(object.amount || order.amount);
  const fee = numberOrNull(object.fee_amount || order.fee_amount);
  const refund = numberOrNull(object.refund_amount);
  let referralAttributionId: string | null = null;
  if (userId) {
    try {
      const { data } = await params.supabase.from("referral_attributions").select("id")
        .eq("referred_user_id", userId).maybeSingle();
      referralAttributionId = data?.id || null;
    } catch {
      referralAttributionId = null;
    }
  }
  const { error } = await params.supabase.from("subscription_events").upsert({
    user_id: userId,
    attribution_id: attributionId,
    campaign_id: campaignId || messageDimensions.campaign_id || null,
    message_id: messageId,
    prospect_id: prospectId || messageDimensions.prospect_id || null,
    provider: "creem",
    provider_event_id: eventId,
    provider_event_type: params.eventType || "unknown",
    event_type: normalizedEventType,
    provider_checkout_id: typeof metadata.checkout_id === "string" ? metadata.checkout_id : (params.eventType === "checkout.completed" && typeof object.id === "string" ? object.id : null),
    provider_payment_id: typeof object.last_transaction_id === "string" ? object.last_transaction_id : typeof order.id === "string" ? order.id : null,
    provider_subscription_id: subscriptionId,
    provider_customer_id: typeof customer.id === "string" ? customer.id : typeof object.customer_id === "string" ? object.customer_id : null,
    outreach_message_id: typeof metadata.outreach_message_id === "string" ? metadata.outreach_message_id : null,
    plan: typeof metadata.plan === "string" ? metadata.plan : null,
    billing_interval: typeof metadata.billing_interval === "string" ? metadata.billing_interval : null,
    currency: typeof object.currency === "string" ? object.currency : typeof order.currency === "string" ? order.currency : null,
    gross_amount: gross,
    fee_amount: fee,
    refund_amount: refund,
    net_amount: gross === null ? null : gross - (fee || 0) - (refund || 0),
    referral_amount: numberOrNull(metadata.referral_amount),
    referral_attribution_id: referralAttributionId,
    template_key: typeof metadata.template_key === "string" ? metadata.template_key : messageDimensions.template_key || null,
    step_key: typeof metadata.step_key === "string" ? metadata.step_key : messageDimensions.step_key || null,
    list_tier: typeof metadata.list_tier === "string" ? metadata.list_tier : messageDimensions.list_tier || null,
    country_code: typeof metadata.country_code === "string" ? metadata.country_code : messageDimensions.country_code || null,
    source_keyword: typeof metadata.source_keyword === "string" ? metadata.source_keyword : messageDimensions.source_keyword || null,
    market: typeof metadata.market === "string" ? metadata.market : messageDimensions.market || null,
    matched: Boolean(userId || attributionId || campaignId),
    reconciliation_status: normalizedEventType === "subscription_paid_unclassified" ? "needs_review" : userId ? "matched" : "unmatched",
    occurred_at: typeof params.event.created_at === "string" ? params.event.created_at : null,
    raw_payload: params.event,
    source: "creem",
    idempotency_key: idempotencyKey,
  }, { onConflict: "source,idempotency_key", ignoreDuplicates: true });
  if (error) throw error;
}
