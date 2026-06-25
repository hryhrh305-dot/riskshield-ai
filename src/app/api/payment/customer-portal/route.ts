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

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const apiBaseUrl = getCreemApiBaseUrl(creemApiKey);
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

    const portalResponse = await fetch(`${apiBaseUrl}/customers/billing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": creemApiKey,
      },
      body: JSON.stringify({
        customer_id: customerData.id,
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
