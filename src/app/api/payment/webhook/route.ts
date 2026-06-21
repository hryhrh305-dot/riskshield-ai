import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ");
const CREEM_WEBHOOK_SECRET = "whsec_zV3bnYsZQQrHOiqVkDXkg";

const supabaseAdmin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function verifySignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac("sha256", CREEM_WEBHOOK_SECRET);
  const digest = hmac.update(payload, "utf-8").digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const signature = req.headers.get("x-creem-signature") || "";
    if (!verifySignature(payload, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const event = JSON.parse(payload);
    switch (event.type) {
      case "checkout.completed": {
        const userId = event.metadata?.user_id;
        const plan = event.metadata?.plan || "starter";
        if (!userId) break;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        await supabaseAdmin.from("profiles").update({
          plan, subscription_status: "active",
          subscription_start: new Date().toISOString(),
          subscription_end: endDate.toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
        await supabaseAdmin.from("subscriptions").insert({
          user_id: userId, payment_provider: "creem",
          provider_subscription_id: event.subscription_id,
          plan, status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: endDate.toISOString(),
        });
        await supabaseAdmin.from("payments").update({ status: "completed" }).eq("provider_checkout_id", event.checkout_id);
        break;
      }
      case "subscription.cancelled": {
        const subId = event.subscription_id;
        if (!subId) break;
        const { data: sub } = await supabaseAdmin.from("subscriptions").select("user_id").eq("provider_subscription_id", subId).single();
        if (sub) {
          await supabaseAdmin.from("profiles").update({ subscription_status: "cancelled", updated_at: new Date().toISOString() }).eq("id", sub.user_id);
        }
        break;
      }
      case "subscription.expired": {
        const subId = event.subscription_id;
        if (!subId) break;
        const { data: sub } = await supabaseAdmin.from("subscriptions").select("user_id").eq("provider_subscription_id", subId).single();
        if (sub) {
          await supabaseAdmin.from("profiles").update({ plan: "free", subscription_status: "expired", subscription_end: null, updated_at: new Date().toISOString() }).eq("id", sub.user_id);
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
