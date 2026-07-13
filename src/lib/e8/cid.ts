import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type CidKeys = { current: string; previous?: string };
type CidPayload = { v: 1; kid: "current" | "previous"; jti: string; campaignId: string; prospectId: string | null; outreachMessageId: string | null; iat: number; exp: number };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(encoded: string, key: string) {
  return createHmac("sha256", key).update(encoded).digest("base64url");
}

export function createCid(
  input: { campaignId: string; prospectId?: string | null; outreachMessageId?: string | null; ttlSeconds?: number },
  key: string,
  kid: "current" | "previous" = "current",
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: CidPayload = {
    v: 1,
    kid,
    jti: randomBytes(16).toString("hex"),
    campaignId: input.campaignId,
    prospectId: input.prospectId || null,
    outreachMessageId: input.outreachMessageId || null,
    iat: now,
    exp: now + (input.ttlSeconds ?? 30 * 24 * 60 * 60),
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, key)}`;
}

export function verifyCid(token: string | null | undefined, keys: CidKeys): CidPayload | null {
  if (!token || token.length > 2048) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  let payload: CidPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CidPayload;
  } catch {
    return null;
  }
  if (payload.v !== 1 || !["current", "previous"].includes(payload.kid) || !payload.jti || !UUID_RE.test(payload.campaignId)) return null;
  if (payload.prospectId != null && !UUID_RE.test(payload.prospectId)) return null;
  if (payload.outreachMessageId != null && !UUID_RE.test(payload.outreachMessageId)) return null;
  const key = payload.kid === "previous" ? keys.previous : keys.current;
  if (!key) return null;
  const expected = Buffer.from(sign(encoded, key));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat) || payload.exp <= now || payload.iat > now + 300) return null;
  return payload;
}

export function cidKeysFromEnv(env: Record<string, string | undefined> = process.env): CidKeys | null {
  const current = env.E8_CID_HMAC_KEY?.trim();
  if (!current || current.length < 32) return null;
  const previous = env.E8_CID_HMAC_PREVIOUS_KEY?.trim();
  return { current, previous: previous && previous.length >= 32 ? previous : undefined };
}
