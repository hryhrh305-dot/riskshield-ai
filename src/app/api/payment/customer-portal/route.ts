import { NextResponse } from "next/server";
import { getCreemApiBaseUrl } from "@/lib/creem";
import { createServerSupabaseClient } from "@/lib/supabase-server";

async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) return null;
  return user;
}

export async function POST() {
  try {
    const creemApiKey = process.env.CREEM_API_KEY || "";
    if (!creemApiKey) {
      return NextResponse.json({ error: "Creem is not configured." }, { status: 500 });
    }

    const supabase = await createServerSupabaseClient();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("creem_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    const apiBaseUrl = getCreemApiBaseUrl(creemApiKey);
    let customerId = profileRow?.creem_customer_id || null;

    if (!customerId) {
      const customerResponse = await fetch(`${apiBaseUrl}/customers?email=${encodeURIComponent(user.email || "")}`, {
        method: "GET",
        headers: {
          "x-api-key": creemApiKey,
        },
      });

      const customerData = await customerResponse.json().catch(() => null);
      if (!customerResponse.ok || !customerData?.id) {
        return NextResponse.json(
          {
            error: customerData?.message || customerData?.error || "No Creem customer was found for this account.",
          },
          { status: customerResponse.status || 404 },
        );
      }

      customerId = customerData.id;

      await supabase
        .from("profiles")
        .update({
          creem_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    const portalResponse = await fetch(`${apiBaseUrl}/customers/billing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": creemApiKey,
      },
      body: JSON.stringify({
        customer_id: customerId,
      }),
    });

    const portalData = await portalResponse.json().catch(() => null);
    if (!portalResponse.ok || !portalData?.customer_portal_link) {
      return NextResponse.json(
        {
          error: portalData?.message || portalData?.error || "Failed to create Creem customer portal link.",
        },
        { status: portalResponse.status || 500 },
      );
    }

    return NextResponse.json({
      portalUrl: portalData.customer_portal_link,
    });
  } catch (error) {
    console.error("[payment][customer-portal]", error);
    return NextResponse.json({ error: "Failed to open billing portal." }, { status: 500 });
  }
}
