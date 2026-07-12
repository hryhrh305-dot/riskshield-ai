const FALLBACK_APP_URL = "https://www.secwyn.com";

export function getAppUrl(env: NodeJS.ProcessEnv = process.env) {
  return env.NEXT_PUBLIC_APP_URL || FALLBACK_APP_URL;
}

export function buildAuthRedirectUrl(env: NodeJS.ProcessEnv = process.env, next = "/dashboard") {
  const url = new URL("/auth/callback", getAppUrl(env));
  url.searchParams.set("next", next);
  return url.toString();
}
