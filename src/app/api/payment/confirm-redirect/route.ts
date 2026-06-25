import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";
import { findPlanByCreemProductId, getCreditsForPlan, verifyCreemRedirectSignature } from "@/lib/creem";
import { getPlanRank } from "@/lib/plans";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ";
const CREEM_API_KEY = process.env.CREEM_API_KEY || "";

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

  const {
    data: { user },
    error,
  } = await getSupabaseAdmin().auth.getUser(accessToken);

  if (error || !user) return null;
  return user;
}

export async function POST(request: NextRequest) {
  try {
    if (!CREEM_API_KEY) {
      return NextResponse.json({ error: "Billing redirect sync is not configured." }, { status: 500 });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { rawQuery?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const rawQuery = (body.rawQuery || "").replace(/^\?/, "");
    if (!rawQuery) {
      return NextResponse.json({ error: "Missing redirect query." }, { status: 400 });
    }

    if (!verifyCreemRedirectSignature(rawQuery, CREEM_API_KEY)) {
      return NextResponse.json({ error: "Invalid redirect signature." }, { status: 401 });
    }

    const params = new URLSearchParams(rawQuery);
    const checkoutId = params.get("checkout_id");
    const orderId = params.get("order_id");
    const customerId = params.get("customer_id");
    const productId = params.get("product_id");

    if (!checkoutId || !productId) {
      return NextResponse.json({ error: "Missing checkout context." }, { status: 400 });
    }

    const paymentAdmin = getSupabaseAdmin();
    const { data: paymentRow } = await paymentAdmin
      .from("payments")
      .select("id, plan, status")
      .eq("user_id", user.id)
      .eq("provider", "creem")
      .eq("provider_checkout_id", checkoutId)
      .maybeSingle();

    if (!paymentRow) {
      return NextResponse.json({ error: "Matching payment record not found." }, { status: 404 });
    }

    const resolvedPlan = findPlanByCreemProductId(productId) || paymentRow.plan || "starter";
    const credits = getCreditsForPlan(resolvedPlan);

    await paymentAdmin
      .from("payments")
      .update({
        status: "completed",
        provider_transaction_id: orderId || null,
      })
      .eq("id", paymentRow.id);

    const { data: currentProfile } = await paymentAdmin
      .from("profiles")
      .select("plan, credits_remaining")
      .eq("id", user.id)
      .maybeSingle();

    const currentPlan = currentProfile?.plan || "free";
    const shouldUpgrade = getPlanRank(resolvedPlan) >= getPlanRank(currentPlan);

    await paymentAdmin
      .from("profiles")
      .update({
        plan: shouldUpgrade ? resolvedPlan : currentPlan,
        subscription_status: "active",
        subscription_start: new Date().toISOString(),
        credits_remaining: shouldUpgrade ? credits : currentProfile?.credits_remaining ?? credits,
        ...(customerId ? { creem_customer_id: customerId } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      activatedPlan: shouldUpgrade ? resolvedPlan : currentPlan,
      paymentStatus: "completed",
    });
  } catch (error) {
    console.error("Confirm redirect error:", error);
    return NextResponse.json({ error: "Failed to confirm billing redirect." }, { status: 500 });
  }
}
