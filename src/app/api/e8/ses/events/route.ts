import { NextRequest, NextResponse } from "next/server";
import { getE8Flags } from "@/lib/e8/flags";
import { validateSnsEnvelope, verifySnsSignature } from "@/lib/e8/sns";
import { parseSesNotification } from "@/lib/e8/ses";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordSesEvent } from "@/lib/e8/repository";
import { safeEnvNumber } from "@/lib/e8/server";

const MAX_BODY = 1_048_576;
export type SnsVerify = typeof verifySnsSignature;

export async function handleSesRequest(request: NextRequest, verifySignature: SnsVerify = verifySnsSignature) {
  const flags = getE8Flags();
  if (!flags.observability || !flags.sesIngestion) return NextResponse.json({ received: true, enabled: false });
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const topics = (process.env.AWS_SNS_ALLOWED_TOPIC_ARNS || "").split(",").map((item) => item.trim()).filter(Boolean);
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const envelope = validateSnsEnvelope(JSON.parse(raw), topics);
    if (!envelope || !(await verifySignature(envelope))) return NextResponse.json({ error: "Invalid notification" }, { status: 401 });
    if (envelope.type !== "Notification") {
      return NextResponse.json({ received: true, confirmation: "manual_required" }, { status: 202 });
    }
    let inner: unknown;
    try { inner = JSON.parse(envelope.message); } catch { inner = { eventType: "Unknown", mail: { messageId: envelope.messageId, timestamp: envelope.timestamp, destination: [] }, unparsedMessage: envelope.message }; }
    const event = parseSesNotification(inner);
    if (!event) return NextResponse.json({ received: true, stored: false }, { status: 202 });
    const identitySecret = process.env.E8_IDENTITY_HMAC_KEY || "";
    if (identitySecret.length < 32) return NextResponse.json({ error: "Ingestion configuration unavailable" }, { status: 503 });
    await recordSesEvent({
      supabase: getSupabaseAdminClient(), event, snsMessageId: envelope.messageId, identitySecret,
      safetyAutopause: flags.safetyAutopause,
      hardBounceThreshold: safeEnvNumber(process.env.E8_HARD_BOUNCE_PAUSE_RATE, 0.02),
      complaintThreshold: safeEnvNumber(process.env.E8_COMPLAINT_PAUSE_RATE, 0.0005),
    });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: false }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  return handleSesRequest(request);
}
