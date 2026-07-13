type RateBucket = { startedAt: number; count: number };
const buckets = new Map<string, RateBucket>();

export function isSameOrigin(origin: string | null, requestUrl: string, configuredAppUrl?: string | null) {
  if (!origin) return false;
  try {
    const value = new URL(origin).origin;
    const allowed = new Set([new URL(requestUrl).origin]);
    if (configuredAppUrl) allowed.add(new URL(configuredAppUrl).origin);
    return allowed.has(value);
  } catch {
    return false;
  }
}

export function allowE8Request(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) if (now - bucket.startedAt >= windowMs) buckets.delete(bucketKey);
  }
  return true;
}

export function requestRateKey(headers: Headers, route: string) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${route}:${forwarded || headers.get("x-real-ip") || "unknown"}`;
}

export function safeRate(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 1 ? number : fallback;
}
