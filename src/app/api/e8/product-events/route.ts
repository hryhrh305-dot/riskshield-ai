import { NextRequest, NextResponse } from "next/server";
import { getE8Flags } from "@/lib/e8/flags";
import { parseProductEvent } from "@/lib/e8/validation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordProductEvent } from "@/lib/e8/repository";
import { getOptionalUser } from "@/lib/e8/server";
import { anonymousKeyFromEnv, canonicalActivationKey, verifyAnonymousSession } from "@/lib/e8/anonymous";
import { allowE8Request, isSameOrigin, requestRateKey } from "@/lib/e8/security";

const MAX_BODY = 12_288;

export async function POST(request: NextRequest) {
  const flags = getE8Flags();
  if (!flags.observability) return NextResponse.json({ received: true, enabled: false });
  if (!isSameOrigin(request.headers.get("origin"), request.url, process.env.NEXT_PUBLIC_APP_URL)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!allowE8Request(requestRateKey(request.headers, "product-events"), 120)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const anonymousKey = anonymousKeyFromEnv();
    const anonymous = anonymousKey ? verifyAnonymousSession(request.cookies.get("secwyn_e8_anon")?.value, anonymousKey) : null;
    if (!anonymous) return NextResponse.json({ error: "Invalid anonymous session" }, { status: 401 });
    const event = parseProductEvent(JSON.parse(raw), anonymous.anonymousId);
    if (!event) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    const user = await getOptionalUser();
    if (event.eventName === "activation_completed") {
      event.idempotencyKey = canonicalActivationKey(user?.id || anonymous.anonymousId, anonymousKey!);
    }
    const rawAttributionId = request.cookies.get("secwyn_e8_attribution")?.value || "";
    let attributionId = /^[0-9a-f-]{36}$/i.test(rawAttributionId) ? rawAttributionId : null;
    if (attributionId) {
      const query = getSupabaseAdminClient().from("acquisition_attribution").select("id,user_id").eq("id", attributionId).eq("anonymous_id", anonymous.anonymousId).maybeSingle();
      const { data, error } = await query;
      if (error || !data || (data.user_id && data.user_id !== user?.id)) attributionId = null;
    }
    await recordProductEvent({ supabase: getSupabaseAdminClient(), event, userId: user?.id, attributionId });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: false }, { status: 503 });
  }
}
