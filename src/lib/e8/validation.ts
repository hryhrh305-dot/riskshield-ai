import { PRODUCT_EVENT_NAMES, type ProductEventName } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_VALUE_RE = /^[a-zA-Z0-9_./:-]{1,128}$/;

export type ParsedProductEvent = {
  eventName: ProductEventName;
  anonymousId: string;
  idempotencyKey: string;
  path: string | null;
  properties: Record<string, string | number | boolean | null>;
};

export function parseProductEvent(input: unknown, trustedAnonymousId?: string): ParsedProductEvent | null {
  if (!input || typeof input !== "object") return null;
  const body = input as Record<string, unknown>;
  if (!PRODUCT_EVENT_NAMES.includes(body.event_name as ProductEventName)) return null;
  const anonymousId = trustedAnonymousId || body.anonymous_id;
  if (typeof anonymousId !== "string" || !UUID_RE.test(anonymousId)) return null;
  if (typeof body.idempotency_key !== "string" || !/^[a-zA-Z0-9:_-]{1,160}$/.test(body.idempotency_key)) return null;
  if (body.path != null && (typeof body.path !== "string" || body.path.length > 512 || !body.path.startsWith("/") || /@|%40/i.test(body.path))) return null;

  const properties: Record<string, string | number | boolean | null> = {};
  if (body.properties != null) {
    if (typeof body.properties !== "object" || Array.isArray(body.properties)) return null;
    for (const [key, value] of Object.entries(body.properties as Record<string, unknown>)) {
      if (!SAFE_VALUE_RE.test(key) || Object.keys(properties).length >= 20) return null;
      if (value === null || typeof value === "number" || typeof value === "boolean") properties[key] = value;
      else if (typeof value === "string" && value.length <= 128 && !value.includes("@")) properties[key] = value;
      else return null;
    }
  }
  return {
    eventName: body.event_name as ProductEventName,
    anonymousId,
    idempotencyKey: body.idempotency_key,
    path: typeof body.path === "string" ? body.path : null,
    properties,
  };
}
