import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { NextRequest } from "next/server";
import { getE8Flags } from "./flags";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordProductEvent } from "./repository";
import { anonymousKeyFromEnv, verifyAnonymousSession } from "./anonymous";
import { createHash } from "node:crypto";

export async function getOptionalUser() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    return data.user || null;
  } catch {
    return null;
  }
}

export { safeRate as safeEnvNumber } from "./security";

export async function recordAuthCompletionBestEffort(request: NextRequest, userId: string) {
  if (!getE8Flags().observability) return;
  const key = anonymousKeyFromEnv();
  const anonymous = key ? verifyAnonymousSession(request.cookies.get("secwyn_e8_anon")?.value, key) : null;
  const attributionId = request.cookies.get("secwyn_e8_attribution")?.value;
  if (!anonymous || !attributionId || !/^[0-9a-f-]{36}$/i.test(attributionId)) return;
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.from("acquisition_attribution").select("id,user_id")
      .eq("id", attributionId).eq("anonymous_id", anonymous.anonymousId).maybeSingle();
    if (error || !data || (data.user_id && data.user_id !== userId)) return;
    const completedAt = new Date().toISOString();
    const binding = !data.user_id
      ? await admin.from("acquisition_attribution").update({ user_id: userId, registered_at: completedAt, updated_at: completedAt }).eq("id", data.id).is("user_id", null)
      : await admin.from("acquisition_attribution").update({ registered_at: completedAt, updated_at: completedAt }).eq("id", data.id).eq("user_id", userId);
    if (binding.error) throw binding.error;
    const userHash = createHash("sha256").update(userId).digest("hex");
    for (const eventName of ["email_verified", "signup_completed"] as const) {
      await recordProductEvent({
        supabase: admin, attributionId: data.id, userId,
        event: { eventName, anonymousId: anonymous.anonymousId, idempotencyKey: `auth:${eventName}:${userHash}`, path: "/auth/callback", properties: {} },
        source: "auth",
      });
    }
  } catch {
    // Auth completion must never depend on observability.
  }
}
