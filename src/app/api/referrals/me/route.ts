import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server";
import { issueDueReferralRewards } from "@/lib/referral-rewards";
import { findBillingCatalogEntryByProductId } from "@/lib/billing-catalog";

type ReferralCodeRow = {
  code: string;
};

const CODE_LENGTH = 10;

function buildReferralUrl(request: NextRequest, code: string) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    request.nextUrl.origin;

  const baseUrl = configuredUrl.replace(/\/$/, "");
  return `${baseUrl}/signup?ref=${encodeURIComponent(code)}`;
}

function createReferralCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function getUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

async function ensureReferralCode(userId: string) {
  const supabase = await createServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle<ReferralCodeRow>();

  if (existingError) throw existingError;
  if (existing?.code) return existing.code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createReferralCode();
    const { data, error } = await supabase
      .from("referral_codes")
      .insert({ user_id: userId, code })
      .select("code")
      .single<ReferralCodeRow>();

    if (!error && data?.code) return data.code;
    if (error?.code !== "23505") throw error;
  }

  throw new Error("Could not create referral code.");
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();
    const code = await ensureReferralCode(user.id);
    await issueDueReferralRewards({ supabase, referrerUserId: user.id });
    const { data: creditSummary, error: creditSummaryError } = await supabase.rpc("get_credit_summary", { p_user_id: user.id });
    if (creditSummaryError) throw creditSummaryError;
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("provider_product_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    const catalogEntry = findBillingCatalogEntryByProductId(subscription?.provider_product_id || null);

    const [{ count: registeredCount,error:registeredError }, { count: pendingCount,error:pendingError }, { data: recentAttributions,error:recentError }] = await Promise.all([
      supabase
        .from("referral_attributions")
        .select("id", { count: "exact", head: true })
        .eq("referrer_user_id", user.id),
      supabase
        .from("referral_attributions")
        .select("id", { count: "exact", head: true })
        .eq("referrer_user_id", user.id)
        .in("reward_status", ["not_eligible_yet", "pending_review", "manual_review"]),
      supabase
        .from("referral_attributions")
        .select("created_at,status,reward_status")
        .eq("referrer_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    if(registeredError||pendingError||recentError) throw registeredError||pendingError||recentError;

    return NextResponse.json({
      code,
      referralUrl: buildReferralUrl(request, code),
      stats: {
        registeredCount: registeredCount ?? 0,
        pendingCount: pendingCount ?? 0,
      },
      recentAttributions: recentAttributions ?? [],
      credits: creditSummary,
      subscriptionEntitlement: catalogEntry ? {
        generation: catalogEntry.generation,
        interval: catalogEntry.interval,
        plan: catalogEntry.plan,
        monthlyCredits: catalogEntry.monthlyCredits,
      } : null,
    });
  } catch (error) {
    console.error("[referrals/me][GET]", error);
    return NextResponse.json({ error: "Failed to load referral link." }, { status: 500 });
  }
}
