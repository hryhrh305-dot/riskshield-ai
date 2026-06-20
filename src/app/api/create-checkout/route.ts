import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { plans, PlanKey } from "@/lib/plans";

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

    // Create Creem checkout
    const response = await fetch("https://api.creem.io/v1/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CREEM_API_KEY!,
      },
      body: JSON.stringify({
        product_id: process.env.CREEM_PRODUCT_ID,
        request_id: crypto.randomUUID(),
        success_url: process.env.NEXT_PUBLIC_APP_URL + "/dashboard?checkout=success",
        metadata: {
          user_id: user.id,
          plan: planKey,
        },
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
