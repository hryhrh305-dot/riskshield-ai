import { extractEventType, extractPaymentIdentifiers, type CreemWebhookEvent } from "@/lib/creem-webhook";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function minorUnits(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed / 100 : null;
}

export type TestCanaryWebhookPayload = {
  eventType: string;
  metadata: JsonRecord;
  productId: string | null;
  checkoutId: string | null;
  transactionId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  amount: number | null;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
};

/**
 * Normalizes only Creem's documented webhook shapes. The event type decides
 * which top-level object.id represents so checkout and subscription IDs cannot
 * be accidentally interchanged.
 */
export function parseTestCanaryWebhookPayload(event: CreemWebhookEvent): TestCanaryWebhookPayload {
  const eventType = extractEventType(event);
  const object = record(event.object);
  const order = record(object.order);
  const product = record(object.product);
  const customer = record(object.customer);
  const subscription = record(object.subscription);
  const identifiers = extractPaymentIdentifiers(event);
  const metadata = { ...record(subscription.metadata), ...record(object.metadata) };

  const checkoutId = eventType === "checkout.completed"
    ? stringValue(object.id) || identifiers.checkoutId
    : identifiers.checkoutId;
  const subscriptionId = eventType === "subscription.paid"
    ? stringValue(object.id) || identifiers.subscriptionId
    : identifiers.subscriptionId;

  return {
    eventType,
    metadata,
    productId: stringValue(product.id)
      || stringValue(record(subscription.product).id)
      || stringValue(order.product)
      || stringValue(object.product_id),
    checkoutId,
    transactionId: eventType === "subscription.paid"
      ? stringValue(object.last_transaction_id) || identifiers.transactionId
      : identifiers.transactionId,
    subscriptionId,
    customerId: identifiers.customerId || stringValue(customer.id),
    amount: minorUnits(object.amount_paid)
      ?? minorUnits(record(object.transaction).amount_paid)
      ?? minorUnits(order.amount_paid)
      ?? minorUnits(order.amount)
      ?? minorUnits(product.price),
    currency: stringValue(product.currency)
      || stringValue(object.currency)
      || stringValue(order.currency)
      || "USD",
    periodStart: stringValue(object.current_period_start_date ?? subscription.current_period_start_date),
    periodEnd: stringValue(object.current_period_end_date ?? subscription.current_period_end_date),
  };
}
