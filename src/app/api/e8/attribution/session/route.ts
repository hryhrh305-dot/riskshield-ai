import { NextRequest, NextResponse } from "next/server";
import { getE8Flags } from "@/lib/e8/flags";
import { cidKeysFromEnv, verifyCid } from "@/lib/e8/cid";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAttribution } from "@/lib/e8/repository";
import { getOptionalUser } from "@/lib/e8/server";
import { anonymousKeyFromEnv, createAnonymousSession, createOpaqueLandingKey, verifyAnonymousSession } from "@/lib/e8/anonymous";
import { allowE8Request, isSameOrigin, requestRateKey } from "@/lib/e8/security";

const MAX_BODY = 8_192;
const safeText = (value: unknown, max = 200) => typeof value === "string" && value.length <= max && !/@|%40/i.test(value) ? value : null;

export async function POST(request: NextRequest) {
  const flags = getE8Flags();
  if (!flags.observability || !flags.attribution) return NextResponse.json({ enabled: false });
  if (!isSameOrigin(request.headers.get("origin"), request.url, process.env.NEXT_PUBLIC_APP_URL)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!allowE8Request(requestRateKey(request.headers, "attribution"), 60)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const body = JSON.parse(text) as Record<string, unknown>;
    if (typeof body.path !== "string" || !safeText(body.path, 512) || !body.path.startsWith("/")) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    const anonymousKey = anonymousKeyFromEnv();
    if (!anonymousKey) return NextResponse.json({ error: "Attribution configuration unavailable" }, { status: 503 });
    const existingAnonymous = verifyAnonymousSession(request.cookies.get("secwyn_e8_anon")?.value, anonymousKey);
    const anonymousId = existingAnonymous?.anonymousId || crypto.randomUUID();
    const keys = cidKeysFromEnv();
    let cid = keys && typeof body.cid === "string" ? verifyCid(body.cid, keys) : null;
    if (cid?.outreachMessageId) {
      const { data: message, error: messageError } = await getSupabaseAdminClient().from("outreach_messages")
        .select("campaign_id,prospect_id").eq("id", cid.outreachMessageId).maybeSingle();
      if (messageError || !message || message.campaign_id !== cid.campaignId || message.prospect_id !== cid.prospectId) cid = null;
    }
    const user = await getOptionalUser();
    const row = await recordAttribution({
      supabase: getSupabaseAdminClient(), anonymousId, userId: user?.id,
      campaignId: cid?.campaignId, prospectId: cid?.prospectId, messageId: cid?.outreachMessageId,
      cidJti: cid?.jti, path: safeText(body.path, 512),
      utm: {
        source: safeText(body.utm_source), medium: safeText(body.utm_medium), campaign: safeText(body.utm_campaign),
        content: safeText(body.utm_content), term: safeText(body.utm_term),
      },
    });
    const response = NextResponse.json({ enabled: true, attributed: Boolean(cid), bound: Boolean(user), landing_key: cid ? createOpaqueLandingKey(cid.jti, anonymousKey) : null });
    response.cookies.set("secwyn_e8_attribution", row.id, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 });
    response.cookies.set("secwyn_e8_anon", createAnonymousSession({ anonymousId }, anonymousKey), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 });
    return response;
  } catch {
    return NextResponse.json({ enabled: true, attributed: false });
  }
}
