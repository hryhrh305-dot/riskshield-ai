import { createHash } from "node:crypto";

export async function enqueueAffiliateEvent(input: { aggregateType: string; aggregateId: string; eventType: string; payload: Record<string, unknown>; sourceId: string }) {
  const idempotencyKey = createHash("sha256").update(`secwyn-india|${input.eventType}|${input.sourceId}`).digest("hex");
  const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("affiliate_outbox_events").upsert({
    program_id: "secwyn-india", aggregate_type: input.aggregateType, aggregate_id: input.aggregateId,
    event_type: input.eventType, payload: input.payload, idempotency_key: idempotencyKey,
  }, { onConflict: "program_id,idempotency_key", ignoreDuplicates: true }).select("id,status").maybeSingle();
  if (error) throw new Error("AFFILIATE_OUTBOX_WRITE_FAILED");
  return data;
}
