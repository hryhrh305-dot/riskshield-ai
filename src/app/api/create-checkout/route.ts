import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { plans, type PlanKey } from "@/lib/plans";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";
import {
  getCreemApiBaseUrl,
  getCreemCheckoutUrls,
  getCreemProductIdForPlan,
  isCreemSelfServePlan,
} from "@/lib/creem";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ";

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
    if (!creemApiKey) {
      return NextResponse.json({ error: "Creem is not configured." }, { status: 500 });
    }

    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    let body: { plan?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const planKey = (body.plan as PlanKey) || "starter";
    if (!isCreemSelfServePlan(planKey)) {
      return NextResponse.json({ error: "This plan is not available for self-serve checkout." }, { status: 400 });
    }

    const productId = getCreemProductIdForPlan(planKey);
    if (!productId) {
      return NextResponse.json({ error: `Missing Creem product mapping for ${planKey}.` }, { status: 500 });
    }

    const checkoutUrls = getCreemCheckoutUrls();
    const apiBaseUrl = getCreemApiBaseUrl(creemApiKey);
    const requestId = crypto.randomUUID();
    const plan = plans[planKey];

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
        metadata: {
          user_id: user.id,
          plan: planKey,
          source: "pricing-page",
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
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
      amount: plan.price,
      currency: "USD",
      status: "pending",
      plan: planKey,
    });

    return NextResponse.json({
      checkoutUrl: data.checkout_url,
      successUrl: checkoutUrls.successUrl,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
