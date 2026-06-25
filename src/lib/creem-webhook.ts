type JsonRecord = Record<string, unknown>;

export type CreemWebhookEvent = JsonRecord & {
  eventType?: string;
  type?: string;
  object?: JsonRecord;
  customer_id?: string | null;
};

export type BillingLookupCandidateKind =
  | "transaction"
  | "checkout"
  | "subscription"
  | "customer"
  | "user"
  | "profile";

export type BillingLookupCandidate = {
  kind: BillingLookupCandidateKind;
  value: string;
};

export const CREEM_HANDLED_EVENT_TYPES = [
  "checkout.completed",
  "subscription.active",
  "subscription.paid",
  "subscription.update",
  "subscription.canceled",
  "subscription.scheduled_cancel",
  "subscription.unpaid",
  "subscription.past_due",
  "subscription.paused",
  "subscription.expired",
  "refund.created",
  "dispute.created",
] as const;

export const BILLING_REVOKE_EVENTS = [
  "refund.created",
  "dispute.created",
] as const;

export const BILLING_RISK_EVENTS = [...BILLING_REVOKE_EVENTS] as const;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function getNestedString(
  source: unknown,
  path: readonly string[],
): string | null {
  let current: unknown = source;

  for (const key of path) {
    const record = asRecord(current);
    if (!record || !(key in record)) return null;
    current = record[key];
  }

  return typeof current === "string" && current.trim() ? current : null;
}

function pushCandidate(
  target: BillingLookupCandidate[],
  seen: Set<string>,
  kind: BillingLookupCandidateKind,
  value: string | null,
) {
  if (!value) return;
  const normalized = value.trim();
  if (!normalized) return;

  const signature = `${kind}:${normalized}`;
  if (seen.has(signature)) return;
  seen.add(signature);
  target.push({ kind, value: normalized });
}

export function extractEventType(event: CreemWebhookEvent): string {
  return event.eventType || event.type || "";
}

export function extractCustomerId(event: CreemWebhookEvent): string | null {
  return (
    getNestedString(event, ["object", "customer_id"]) ||
    getNestedString(event, ["object", "customer", "id"]) ||
    getNestedString(event, ["object", "customer", "customer_id"]) ||
    getNestedString(event, ["object", "subscription", "customer_id"]) ||
    getNestedString(event, ["object", "subscription", "customer", "id"]) ||
    (typeof event.customer_id === "string" && event.customer_id.trim() ? event.customer_id : null)
  );
}

export function extractPaymentIdentifiers(event: CreemWebhookEvent) {
  const objectMetadata = asRecord(asRecord(event.object)?.metadata);
  const subscriptionMetadata = asRecord(
    asRecord(asRecord(event.object)?.subscription)?.metadata,
  );

  return {
    transactionId:
      getNestedString(event, ["object", "transaction_id"]) ||
      getNestedString(event, ["object", "last_transaction_id"]) ||
      getNestedString(event, ["object", "payment", "id"]),
    checkoutId:
      getNestedString(event, ["object", "checkout_id"]) ||
      getNestedString(event, ["object", "checkout", "id"]),
    orderId:
      getNestedString(event, ["object", "order", "id"]) ||
      getNestedString(event, ["object", "order_id"]),
    subscriptionId:
      getNestedString(event, ["object", "subscription", "id"]) ||
      getNestedString(event, ["object", "id"]),
    customerId: extractCustomerId(event),
    metadataUserId:
      getNestedString(objectMetadata, ["user_id"]) ||
      getNestedString(objectMetadata, ["userId"]) ||
      getNestedString(objectMetadata, ["referenceId"]) ||
      getNestedString(subscriptionMetadata, ["user_id"]) ||
      getNestedString(subscriptionMetadata, ["userId"]) ||
      getNestedString(subscriptionMetadata, ["referenceId"]),
    metadataProfileId:
      getNestedString(objectMetadata, ["profile_id"]) ||
      getNestedString(objectMetadata, ["profileId"]) ||
      getNestedString(subscriptionMetadata, ["profile_id"]) ||
      getNestedString(subscriptionMetadata, ["profileId"]),
    metadataEmail:
      getNestedString(objectMetadata, ["email"]) ||
      getNestedString(objectMetadata, ["user_email"]) ||
      getNestedString(subscriptionMetadata, ["email"]) ||
      getNestedString(subscriptionMetadata, ["user_email"]),
  };
}

export function getBillingLookupCandidates(
  event: CreemWebhookEvent,
): BillingLookupCandidate[] {
  const identifiers = extractPaymentIdentifiers(event);
  const candidates: BillingLookupCandidate[] = [];
  const seen = new Set<string>();

  pushCandidate(candidates, seen, "transaction", identifiers.transactionId);
  pushCandidate(candidates, seen, "checkout", identifiers.checkoutId);
  pushCandidate(candidates, seen, "subscription", identifiers.subscriptionId);
  pushCandidate(candidates, seen, "customer", identifiers.customerId);
  pushCandidate(candidates, seen, "user", identifiers.metadataUserId);
  pushCandidate(candidates, seen, "profile", identifiers.metadataProfileId);

  return candidates;
}
