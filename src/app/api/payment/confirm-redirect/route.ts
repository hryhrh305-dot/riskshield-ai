import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";
import { findPlanByCreemProductId, verifyCreemRedirectSignature } from "@/lib/creem";
import { getAdminV2CanaryDecision } from "@/lib/admin-v2-canary";
import { findTestCanaryProductById } from "@/lib/test-canary-billing";
import { resolveTestCanarySuccessState } from "@/lib/test-canary-success-state";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const CREEM_API_KEY = process.env.CREEM_API_KEY || "";

type TestPaymentRow = { id: string; status: string; plan: string; billing_interval: string; correlation_id: string };
type TestSubscriptionRow = { status: string };
type TestGrantRow = { status: string };
type LivePaymentRow = { id: string; plan: string | null; status: string };
type LiveProfileRow = { plan: string; subscription_status: string };

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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
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

    const params = new URLSearchParams(rawQuery);
    const checkoutId = params.get("checkout_id");
    const productId = params.get("product_id");

    if (!checkoutId || !productId) {
      return NextResponse.json({ error: "Missing checkout context." }, { status: 400 });
    }

    const testProduct = findTestCanaryProductById(productId, process.env);
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({
        error: "Unauthorized",
        code: "REDIRECT_AUTH_REQUIRED",
        ...(testProduct ? { billingEnvironment: "test_canary", testStatus: "redirect_unverified" } : {}),
      }, { status: 401 });
    }

    if (testProduct) {
      const testApiKey = process.env.CREEM_CANARY_TEST_API_KEY || "";
      const canary = getAdminV2CanaryDecision({ verified: true, email: user.email || null }, process.env);
      if (!canary.enabled || !testApiKey) {
        return NextResponse.json({
          error: "Test Canary redirect is not available.",
          code: "TEST_REDIRECT_NOT_AVAILABLE",
          billingEnvironment: "test_canary",
          testStatus: "redirect_unverified",
        }, { status: 403 });
      }
      if (!verifyCreemRedirectSignature(rawQuery, testApiKey)) {
        return NextResponse.json({
          error: "Invalid redirect signature.",
          code: "TEST_REDIRECT_SIGNATURE_INVALID",
          billingEnvironment: "test_canary",
          testStatus: "redirect_unverified",
        }, { status: 401 });
      }

      const { data: testPaymentData, error: testPaymentError } = await getSupabaseAdmin()
        .from("test_canary_payments")
        .select("id,status,plan,billing_interval,correlation_id")
        .eq("billing_environment", "test_canary")
        .eq("user_id", user.id)
        .eq("provider_checkout_id", checkoutId)
        .eq("provider_product_id", productId)
        .maybeSingle();
      if (testPaymentError) throw testPaymentError;
      const testPayment = testPaymentData as TestPaymentRow | null;
      if (!testPayment) return NextResponse.json({
        error: "Matching Test Canary payment not found.",
        code: "TEST_PAYMENT_NOT_FOUND",
        billingEnvironment: "test_canary",
        testStatus: "webhook_pending",
      }, { status: 404 });

      const [{ data: subscriptionData, error: subscriptionError }, { data: grantData, error: grantError }] = await Promise.all([
        getSupabaseAdmin()
          .from("test_canary_subscriptions")
          .select("status")
          .eq("billing_environment", "test_canary")
          .eq("user_id", user.id)
          .eq("provider_product_id", productId)
          .eq("correlation_id", testPayment.correlation_id)
          .eq("plan", testPayment.plan)
          .eq("billing_interval", testPayment.billing_interval)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        getSupabaseAdmin()
          .from("test_canary_credit_grants")
          .select("status")
          .eq("billing_environment", "test_canary")
          .eq("user_id", user.id)
          .eq("provider_product_id", productId)
          .eq("payment_id", testPayment.id)
          .eq("plan", testPayment.plan)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (subscriptionError) throw subscriptionError;
      if (grantError) throw grantError;
      const subscription = subscriptionData as TestSubscriptionRow | null;
      const grant = grantData as TestGrantRow | null;
      const testStatus = resolveTestCanarySuccessState({
        redirectVerified: true,
        paymentStatus: testPayment.status,
        subscriptionActive: subscription?.status === "active",
        creditGrantRecorded: grant?.status === "evidence_only",
      });

      return NextResponse.json({
        success: testStatus === "confirmed",
        pending: testStatus === "webhook_pending" || testStatus === "provisioning_pending",
        verified: true,
        billingEnvironment: "test_canary",
        testStatus,
        paymentStatus: testPayment.status,
        plan: testPayment.plan,
        billingInterval: testPayment.billing_interval,
      }, { status: testStatus === "confirmed" ? 200 : 202 });
    }

    if (!CREEM_API_KEY) {
      return NextResponse.json({ error: "Billing redirect sync is not configured." }, { status: 500 });
    }
    if (!verifyCreemRedirectSignature(rawQuery, CREEM_API_KEY)) {
      return NextResponse.json({ error: "Invalid redirect signature." }, { status: 401 });
    }

    const paymentAdmin = getSupabaseAdmin();
    const { data: paymentData, error: paymentError } = await paymentAdmin
      .from("payments")
      .select("id, plan, status")
      .eq("user_id", user.id)
      .eq("provider", "creem")
      .eq("provider_checkout_id", checkoutId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    const paymentRow = paymentData as LivePaymentRow | null;

    if (!paymentRow) {
      return NextResponse.json({ error: "Matching payment record not found." }, { status: 404 });
    }

    const resolvedPlan = findPlanByCreemProductId(productId) || paymentRow.plan || "starter";
    if (paymentRow.status !== "completed") {
      return NextResponse.json({ success: false, pending: true, paymentStatus: paymentRow.status }, { status: 202 });
    }
    const { data: profileData, error: profileError } = await paymentAdmin.from("profiles")
      .select("plan,subscription_status").eq("id",user.id).maybeSingle();
    if (profileError) throw profileError;
    const profileRow = profileData as LiveProfileRow | null;
    if (profileRow?.subscription_status!=="active" || profileRow?.plan!==resolvedPlan) {
      return NextResponse.json({ success:false,pending:true,paymentStatus:"completed" },{status:202});
    }

    return NextResponse.json({
      success: true,
      activatedPlan: resolvedPlan,
      paymentStatus: "completed",
    });
  } catch (error) {
    console.error("Confirm redirect error:", error);
    return NextResponse.json({ error: "Failed to confirm billing redirect." }, { status: 500 });
  }
}
