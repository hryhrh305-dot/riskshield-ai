import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getE8Flags } from "./flags";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LegacyCreemMetadata = { user_id: string; plan: string; billing_interval: string; source: string };

export function safeE8ErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return /^[A-Za-z0-9_:-]{1,64}$/.test(error.code) ? error.code : "unknown";
  }
  return error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(error.name)
    ? error.name
    : "unknown";
}

export function buildCreemCheckoutMetadata(
  base: LegacyCreemMetadata,
  attribution: { attribution_id: string; campaign_id?: string } | null,
  requestId: string,
  enabled: boolean,
) {
  if (!enabled || !attribution) return base;
  return {
    ...base,
    checkout_request_id: requestId,
    attribution_id: attribution.attribution_id,
    ...(attribution.campaign_id ? { campaign_id: attribution.campaign_id } : {}),
  };
}

export function classifyCreemSubscriptionPaid(payload: Record<string, unknown>) {
  const startRaw = payload.current_period_start_date || payload.current_period_start;
  const createdRaw = payload.subscription_created_at || payload.created_at;
  if (typeof startRaw !== "string" || typeof createdRaw !== "string") return "subscription_paid_unclassified" as const;
  const start = Date.parse(startRaw);
  const created = Date.parse(createdRaw);
  if (Number.isNaN(start) || Number.isNaN(created) || start < created - 24 * 60 * 60 * 1000) return "subscription_paid_unclassified" as const;
  return start - created <= 7 * 24 * 60 * 60 * 1000 ? "first_payment" as const : "renewal" as const;
}

async function within<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("E8_TIMEOUT")), timeoutMs)),
  ]);
}

export async function getCreemAttributionMetadata(request: NextRequest, supabase: SupabaseClient, userId: string) {
  const flags = getE8Flags();
  if (!flags.observability) return null;
  const id = request.cookies.get("secwyn_e8_attribution")?.value;
  if (!id || !UUID_RE.test(id)) return null;
  try {
    const { data, error } = await within(supabase
      .from("acquisition_attribution")
      .select("id,campaign_id,anonymous_id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle(), 500);
    if (error || !data) return null;
    return {
      attribution_id: data.id as string,
      campaign_id: (data.campaign_id as string | null) || undefined,
      anonymous_id: data.anonymous_id as string,
    };
  } catch {
    return null;
  }
}
