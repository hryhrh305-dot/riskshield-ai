import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { plans, type PlanKey } from "@/lib/plans";

const CREEM_API_KEY = "creem_test_touUwTvdYVMlsjo2ztA0q";
const CREEM_PRODUCT_ID = "prod_2cn5Ks85DNUADF1GmU96GE";
const NEXT_PUBLIC_APP_URL = "https://574269.xyz";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Please login" }, { status: 401 });
    }

    let body: { plan?: string };
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const planKey = (body.plan as PlanKey) || "starter";
    const plan = plans[planKey];
    if (!plan || planKey === "free") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const response = await fetch("https://api.creem.io/v1/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CREEM_API_KEY,
      },
      body: JSON.stringify({
        product_id: CREEM_PRODUCT_ID,
        request_id: crypto.randomUUID(),
        success_url: NEXT_PUBLIC_APP_URL + "/dashboard?checkout=success",
        metadata: { user_id: user.id, plan: planKey },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.message || "Checkout creation failed" }, { status: 400 });
    }

    await supabase.from("payments").insert({
      user_id: user.id,
      provider: "creem",
      provider_checkout_id: data.id,
      amount: plan.price,
      currency: "USD",
      status: "pending",
      plan: planKey,
    });

    return NextResponse.json({ checkoutUrl: data.checkout_url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
