import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getSupabaseProjectRef, readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";
import type { BillingCatalogGeneration } from "@/lib/billing-catalog";

export type VerifiedCanaryActor = {
  verified: boolean;
  email: string | null;
};

export type AdminV2CanaryDecision = {
  enabled: boolean;
  generation: BillingCatalogGeneration;
  checkoutLocked: boolean;
};

const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

export function parseAdminV2CanaryEmails(value: string | undefined): string[] | null {
  if (!value) return null;

  const emails = value.split(",").map((email) => email.trim().toLowerCase());
  if (emails.length === 0 || emails.some((email) => !EMAIL_PATTERN.test(email))) return null;

  return [...new Set(emails)];
}

export function getAdminV2CanaryDecision(
  actor: VerifiedCanaryActor,
  env: NodeJS.ProcessEnv = process.env,
): AdminV2CanaryDecision {
  if (env.SECWYN_ADMIN_V2_CANARY_ENABLED !== "true" || !actor.verified || !actor.email) {
    return { enabled: false, generation: "legacy", checkoutLocked: false };
  }

  const allowlist = parseAdminV2CanaryEmails(env.SECWYN_V2_CANARY_EMAILS);
  if (!allowlist || !allowlist.includes(actor.email.trim().toLowerCase())) {
    return { enabled: false, generation: "legacy", checkoutLocked: false };
  }

  return { enabled: true, generation: "premium_v2", checkoutLocked: true };
}

export async function resolveVerifiedCanaryActor(
  request: NextRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<VerifiedCanaryActor> {
  if (env.SECWYN_ADMIN_V2_CANARY_ENABLED !== "true") {
    return { verified: false, email: null };
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = env.SUPABASE_SECRET_KEY || "";
  const projectRef = getSupabaseProjectRef(supabaseUrl);
  if (!supabaseUrl || !serviceRoleKey || !projectRef) {
    return { verified: false, email: null };
  }

  const accessToken = readAccessTokenFromCookieHeader(request.headers.get("cookie") || "", projectRef);
  if (!accessToken) return { verified: false, email: null };

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user?.email) return { verified: false, email: null };
    return { verified: true, email: user.email };
  } catch {
    return { verified: false, email: null };
  }
}
