import { createHash } from "node:crypto";
import type { SesEventName } from "./types";

export type ParsedSesEvent = {
  eventType: SesEventName;
  providerMessageId: string;
  occurredAt: string;
  destinations: string[];
  recipientDomain: string | null;
  bounceType: string | null;
  bounceSubtype: string | null;
  complaintType: string | null;
  batchId: string | null;
  raw: Record<string, unknown>;
};

export function parseSesNotification(input: unknown): ParsedSesEvent | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const mail = value.mail as Record<string, unknown> | undefined;
  if (!mail || typeof mail.messageId !== "string" || !mail.messageId || typeof mail.timestamp !== "string") return null;
  const rawType = String(value.eventType || value.notificationType || "unknown").toLowerCase().replace(/[ _-]/g, "");
  const subscription = value.subscription as Record<string, unknown> | undefined;
  const preferences = subscription?.newTopicPreferences as Record<string, unknown> | undefined;
  const topicStatuses = Array.isArray(preferences?.topicSubscriptionStatus)
    ? preferences.topicSubscriptionStatus as Array<Record<string, unknown>>
    : Array.isArray(subscription?.topicSubscriptionStatus)
      ? subscription.topicSubscriptionStatus as Array<Record<string, unknown>>
      : [];
  const subscriptionOptOut = preferences?.unsubscribeAll === true || topicStatuses.some((item) => ["opt_out", "optout", "unsubscribed"].includes(String(item.subscriptionStatus).toLowerCase()));
  let eventType: SesEventName = "unknown";
  if (rawType === "send") eventType = "send";
  else if (rawType === "delivery") eventType = "delivery";
  else if (rawType === "complaint") eventType = "complaint";
  else if (rawType === "reject") eventType = "reject";
  else if (rawType === "deliverydelay") eventType = "delivery_delay";
  else if (rawType === "open") eventType = "open";
  else if (rawType === "click") eventType = "click";
  else if (rawType === "renderingfailure") eventType = "rendering_failure";
  else if (rawType === "unsubscribe" || (rawType === "subscription" && (String(subscription?.subscriptionType).toLowerCase() === "optout" || subscriptionOptOut))) eventType = "unsubscribe";
  else if (rawType === "bounce") {
    const bounce = value.bounce as Record<string, unknown> | undefined;
    eventType = String(bounce?.bounceType).toLowerCase() === "permanent" ? "hard_bounce" : "soft_bounce";
  }
  const recipientsFor = (container: unknown, key: string) => {
    if (!container || typeof container !== "object") return [];
    const rows = (container as Record<string, unknown>)[key];
    return Array.isArray(rows)
      ? rows.map((row) => row && typeof row === "object" ? (row as Record<string, unknown>).emailAddress : null)
        .filter((item): item is string => typeof item === "string" && item.includes("@"))
      : [];
  };
  const eventRecipients = rawType === "bounce"
    ? recipientsFor(value.bounce, "bouncedRecipients")
    : rawType === "complaint"
      ? recipientsFor(value.complaint, "complainedRecipients")
      : [];
  const destinations = eventRecipients.length
    ? eventRecipients
    : Array.isArray(mail.destination) ? mail.destination.filter((item): item is string => typeof item === "string" && item.includes("@")) : [];
  const containerKey: Record<string, string> = { hard_bounce: "bounce", soft_bounce: "bounce", complaint: "complaint", delivery: "delivery", delivery_delay: "deliveryDelay", reject: "reject", open: "open", click: "click", rendering_failure: "failure", unsubscribe: rawType === "subscription" ? "subscription" : "unsubscribe" };
  const container = eventType === "rendering_failure"
    ? (value.failure || value.renderingFailure) as Record<string, unknown> | undefined
    : value[containerKey[eventType]] as Record<string, unknown> | undefined;
  const occurredAt = typeof container?.timestamp === "string" && !Number.isNaN(Date.parse(container.timestamp)) ? container.timestamp : mail.timestamp;
  const tags = mail.tags as Record<string, unknown> | undefined;
  const batchTag = tags?.batch_id;
  const batchId = typeof batchTag === "string" ? batchTag : Array.isArray(batchTag) && typeof batchTag[0] === "string" ? batchTag[0] : null;
  const firstDomain = destinations[0]?.split("@")[1]?.toLowerCase() || null;
  const bounce = value.bounce as Record<string, unknown> | undefined;
  const complaint = value.complaint as Record<string, unknown> | undefined;
  return {
    eventType, providerMessageId: mail.messageId, occurredAt, destinations,
    recipientDomain: firstDomain,
    bounceType: typeof bounce?.bounceType === "string" ? bounce.bounceType : null,
    bounceSubtype: typeof bounce?.bounceSubType === "string" ? bounce.bounceSubType : null,
    complaintType: typeof complaint?.complaintFeedbackType === "string" ? complaint.complaintFeedbackType : null,
    batchId,
    raw: value,
  };
}

export function suppressionReasonForEvent(eventType: SesEventName) {
  return ["hard_bounce", "complaint", "unsubscribe"].includes(eventType) ? eventType as "hard_bounce" | "complaint" | "unsubscribe" : null;
}

export function sesDedupKey(snsMessageId: string) {
  return `sns-v1:${createHash("sha256").update(snsMessageId).digest("hex")}`;
}
