const AFFILIATE_ACCEPTANCE_BRANCH = "codex/secwyn-india-affiliate-full";

export function isAffiliatePreviewRuntime(env: Readonly<Record<string, string | undefined>>) {
  return env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === AFFILIATE_ACCEPTANCE_BRANCH;
}

export function assertAffiliateSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    throw new Error("AFFILIATE_CSRF_REJECTED");
  }
}
