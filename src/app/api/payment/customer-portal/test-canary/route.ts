import { NextResponse } from "next/server";
import { getAdminV2CanaryDecision } from "@/lib/admin-v2-canary";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { TEST_CANARY_API_BASE_URL } from "@/lib/test-canary-billing";

export async function POST() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await sessionClient.auth.getUser();
    if (userError || !user?.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const canary = getAdminV2CanaryDecision({ verified: true, email: user.email }, process.env);
    if (!canary.enabled) {
      return NextResponse.json({ error: "Test Canary portal access denied." }, { status: 403 });
    }

    const testApiKey = process.env.CREEM_CANARY_TEST_API_KEY || "";
    if (!testApiKey) {
      return NextResponse.json({ error: "Test Canary portal is not configured." }, { status: 503 });
    }

    const admin = getSupabaseAdminClient();
    const { data: subscription, error: subscriptionError } = await admin
      .from("test_canary_subscriptions")
      .select("provider_customer_id")
      .eq("billing_environment", "test_canary")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription?.provider_customer_id) {
      return NextResponse.json({ error: "No active Test Canary subscription was found." }, { status: 404 });
    }

    const response = await fetch(`${TEST_CANARY_API_BASE_URL}/customers/billing`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": testApiKey },
      body: JSON.stringify({ customer_id: subscription.provider_customer_id }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.customer_portal_link) {
      return NextResponse.json({ error: data?.message || data?.error || "Failed to create Test Canary portal link." }, {
        status: response.status || 502,
      });
    }
    return NextResponse.json({ portalUrl: data.customer_portal_link, billingEnvironment: "test_canary" });
  } catch (error) {
    console.error("[test-canary-portal]", error instanceof Error ? error.message : "portal_failed");
    return NextResponse.json({ error: "Failed to open Test Canary billing portal." }, { status: 500 });
  }
}
