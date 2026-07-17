import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { type PlanKey } from "@/lib/plans";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";
import {
  getCreemApiBaseUrl,
  getCreemCheckoutUrls,
  isCreemSelfServePlan,
  normalizeCreemBillingInterval,
} from "@/lib/creem";
import { getCheckoutAvailability } from "@/lib/billing-catalog";
import { getAdminV2CanaryDecision } from "@/lib/admin-v2-canary";
import {
  buildTestCanaryCheckoutMetadata,
  getTestCanaryCheckoutDecision,
  TEST_CANARY_API_BASE_URL,
} from "@/lib/test-canary-billing";
import { buildCreemCheckoutMetadata, getCreemAttributionMetadata } from "@/lib/e8/creem";
import { getE8Flags } from "@/lib/e8/flags";
import { recordProductEvent } from "@/lib/e8/repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || "";

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseAdmin;
}

function getProjectRef() {
  return SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split(".")[0] : "";
}

async function getUserFromRequest(request: NextRequest) {
  const projectRef = getProjectRef();
  if (!projectRef) return null;

  const cookieHeader = request.headers.get("cookie") || "";
  const accessToken = readAccessTokenFromCookieHeader(cookieHeader, projectRef);
  if (!accessToken) return null;

  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) return null;
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const creemApiKey = process.env.CREEM_API_KEY || "";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }

    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const canaryDecision = getAdminV2CanaryDecision({
      verified: true,
      email: user.email || null,
    }, process.env);

    let body: { plan?: string; billingInterval?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const planKey = (body.plan as PlanKey) || "starter";
    const billingInterval = normalizeCreemBillingInterval(body.billingInterval);
    if (!isCreemSelfServePlan(planKey)) {
      return NextResponse.json({ error: "This plan is not available for self-serve checkout." }, { status: 400 });
    }

    if (canaryDecision.checkoutLocked) {
      const testDecision = getTestCanaryCheckoutDecision({
        verified: true,
        userId: user.id,
        email: user.email || null,
      }, planKey, billingInterval, process.env);
      if (testDecision.kind === "contact") {
        return NextResponse.json({
          error: "This annual plan is currently contact-led. Contact support@secwyn.com.",
          code: testDecision.reason,
        }, { status: 409 });
      }
      if (testDecision.kind === "denied") {
        const pending = testDecision.reason === "TEST_CHECKOUT_DISABLED";
        return NextResponse.json({
          error: pending
            ? "Premium V2 checkout validation is pending."
            : "Premium V2 Test checkout is not safely configured.",
          code: pending ? "V2_CANARY_CHECKOUT_DISABLED" : testDecision.reason,
        }, { status: pending ? 409 : 503 });
      }

      const requestId = crypto.randomUUID();
      const metadata = buildTestCanaryCheckoutMetadata({
        actor: { verified: true, userId: user.id, email: user.email || null },
        plan: testDecision.plan,
        interval: testDecision.interval,
        correlationId: requestId,
      });
      const testApiKey = process.env.CREEM_CANARY_TEST_API_KEY || "";
      const checkoutUrls = getCreemCheckoutUrls();
      const response = await fetch(`${TEST_CANARY_API_BASE_URL}/checkouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": testApiKey },
        body: JSON.stringify({
          product_id: testDecision.productId,
          request_id: requestId,
          success_url: checkoutUrls.successUrl,
          customer: { email: user.email },
          metadata,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.id || !data?.checkout_url) {
        const errorMessage = data?.message || data?.error || data?.trace_id || "Test checkout creation failed";
        return NextResponse.json({ error: errorMessage }, { status: response.status || 502 });
      }

      const { error: pendingError } = await getSupabaseAdmin().from("test_canary_payments").insert({
        user_id: user.id,
        provider_checkout_id: data.id,
        provider_product_id: testDecision.productId,
        correlation_id: requestId,
        plan: testDecision.plan,
        billing_interval: testDecision.interval,
        amount: testDecision.entry.priceUsd,
        currency: "USD",
        status: "pending",
      } as never);
      if (pendingError) throw pendingError;

      return NextResponse.json({ checkoutUrl: data.checkout_url, successUrl: checkoutUrls.successUrl });
    }

    if (!creemApiKey) {
      return NextResponse.json({ error: "Creem is not configured." }, { status: 500 });
    }

    const availability = getCheckoutAvailability(planKey, billingInterval, process.env);
    if (availability.kind !== "checkout") {
      const status = availability.kind === "contact" ? 409 : 503;
      const error = availability.kind === "contact"
        ? "This annual plan is currently contact-led. Contact support@secwyn.com."
        : "This checkout option is not configured yet.";
      return NextResponse.json({ error, code: availability.reason }, { status });
    }
    const { productId, entry } = availability;

    const checkoutUrls = getCreemCheckoutUrls();
    const apiBaseUrl = getCreemApiBaseUrl(creemApiKey);
    const requestId = crypto.randomUUID();
    const e8Attribution = await getCreemAttributionMetadata(req, getSupabaseAdmin(), user.id);
    const baseMetadata = {
      user_id: user.id,
      plan: planKey,
      billing_interval: billingInterval,
      catalog_generation: entry.generation,
      source: "pricing-page",
    };
    const metadata = buildCreemCheckoutMetadata(baseMetadata, e8Attribution, requestId, getE8Flags().creemMetadata);

    if (getE8Flags().observability && e8Attribution) {
      void recordProductEvent({
        supabase: getSupabaseAdmin(),
        attributionId: e8Attribution.attribution_id,
        userId: user.id,
        event: {
          eventName: "checkout_started",
          anonymousId: e8Attribution.anonymous_id,
          idempotencyKey: requestId,
          path: "/pricing",
          properties: { plan: planKey, billing_interval: billingInterval },
        },
        source: "checkout",
      }).catch(() => undefined);
    }

    const response = await fetch(`${apiBaseUrl}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": creemApiKey,
      },
      body: JSON.stringify({
        product_id: productId,
        request_id: requestId,
        success_url: checkoutUrls.successUrl,
        customer: {
          email: user.email,
        },
        metadata,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      if (getE8Flags().creemMetadata && e8Attribution) {
        console.warn("[e8-creem][checkout-rejected]", {
          status: response.status,
          requestId,
        });
      }
      const errorMessage =
        data?.message ||
        data?.error ||
        data?.trace_id ||
        "Checkout creation failed";
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    await getSupabaseAdmin().from("payments").insert({
      user_id: user.id,
      provider: "creem",
      provider_checkout_id: data.id,
      provider_product_id: productId,
      amount: entry.priceUsd,
      currency: "USD",
      status: "pending",
      plan: planKey,
    } as never);

    return NextResponse.json({
      checkoutUrl: data.checkout_url,
      successUrl: checkoutUrls.successUrl,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
