export function parseCookieHeader(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(";").reduce((acc, chunk) => {
    const [key, ...rest] = chunk.trim().split("=");
    if (!key) return acc;
    acc[key.trim()] = decodeURIComponent(rest.join("="));
    return acc;
  }, {} as Record<string, string>);
}

export function readAuthCookieValue(cookies: Record<string, string>, baseName: string): string | null {
  if (cookies[baseName]) return cookies[baseName];

  const parts = Object.keys(cookies)
    .filter((key) => key.startsWith(baseName + "."))
    .map((key) => {
      const suffix = Number(key.slice(baseName.length + 1));
      return Number.isInteger(suffix) ? ([suffix, cookies[key]] as const) : null;
    })
    .filter((entry): entry is readonly [number, string] => entry !== null)
    .sort((a, b) => a[0] - b[0]);

  if (parts.length === 0) return null;
  return parts.map(([, value]) => value).join("");
}

function decodeMaybeBase64Cookie(rawValue: string): string {
  if (!rawValue.startsWith("base64-")) return rawValue;

  try {
    return Buffer.from(rawValue.slice("base64-".length), "base64").toString("utf8");
  } catch {
    return rawValue;
  }
}

export function extractAccessTokenFromCookieValue(rawValue: string | null | undefined): string | null {
  if (!rawValue) return null;

  const decodedValue = decodeMaybeBase64Cookie(rawValue);
  try {
    const parsed = JSON.parse(decodedValue);
    if (Array.isArray(parsed)) return typeof parsed[0] === "string" ? parsed[0] : null;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object" && typeof parsed.access_token === "string") {
      return parsed.access_token;
    }
  } catch {
    return decodedValue;
  }

  return decodedValue;
}

export function readAccessTokenFromCookieHeader(cookieHeader: string, projectRef: string): string | null {
  const cookies = parseCookieHeader(cookieHeader);
  const rawToken =
    readAuthCookieValue(cookies, `sb-${projectRef}-auth-token`) ||
    readAuthCookieValue(cookies, "sb-access-token");

  return extractAccessTokenFromCookieValue(rawToken);
}
