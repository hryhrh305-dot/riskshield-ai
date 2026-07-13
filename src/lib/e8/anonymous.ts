import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type AnonymousPayload = { v: 1; anonymousId: string; iat: number; exp: number };

function signature(payload: string, key: string) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createAnonymousSession(
  input: { anonymousId?: string; ttlSeconds?: number },
  key: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const value: AnonymousPayload = {
    v: 1,
    anonymousId: input.anonymousId && UUID_RE.test(input.anonymousId) ? input.anonymousId : randomUUID(),
    iat: now,
    exp: now + (input.ttlSeconds ?? 30 * 24 * 60 * 60),
  };
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${signature(payload, key)}`;
}

export function verifyAnonymousSession(token: string | null | undefined, key: string): AnonymousPayload | null {
  if (!token || token.length > 2048 || key.length < 32) return null;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return null;
  const expectedBuffer = Buffer.from(signature(payload, key));
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AnonymousPayload;
    const now = Math.floor(Date.now() / 1000);
    if (parsed.v !== 1 || !UUID_RE.test(parsed.anonymousId) || !Number.isSafeInteger(parsed.iat) || !Number.isSafeInteger(parsed.exp) || parsed.exp <= now || parsed.iat > now + 300) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function anonymousKeyFromEnv(env: Record<string, string | undefined> = process.env) {
  const key = env.E8_ANON_HMAC_KEY?.trim() || "";
  return key.length >= 32 ? key : null;
}

export function createOpaqueLandingKey(jti: string, key: string) {
  return createHmac("sha256", key).update(`landing:v1:${jti}`).digest("base64url");
}

export function canonicalActivationKey(subject: string, key: string) {
  const opaqueSubject = createHmac("sha256", key).update(`activation:v1:${subject}`).digest("base64url");
  return `activation:v1:${opaqueSubject}`;
}
