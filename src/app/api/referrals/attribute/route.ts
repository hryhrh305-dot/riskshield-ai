import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server";

type ReferralCodeRow = {
  code: string;
  user_id: string;
};

async function getUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ref?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" });
  }

  const ref = (body.ref || "").trim().toUpperCase();
  if (!ref) {
    return NextResponse.json({ ok: false, reason: "missing_ref" });
  }

  try {
    const supabase = await createServiceClient();

    const { data: existingAttribution, error: existingError } = await supabase
      .from("referral_attributions")
      .select("id")
      .eq("referred_user_id", user.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingAttribution?.id) {
      return NextResponse.json({ ok: true, status: "already_attributed" });
    }

    const { data: referralCode, error: codeError } = await supabase
      .from("referral_codes")
      .select("code,user_id")
      .eq("code", ref)
      .maybeSingle<ReferralCodeRow>();

    if (codeError) throw codeError;
    if (!referralCode) {
      return NextResponse.json({ ok: false, reason: "invalid_ref" });
    }

    if (referralCode.user_id === user.id) {
      return NextResponse.json({ ok: false, reason: "self_referral" });
    }

    const { error: insertError } = await supabase.from("referral_attributions").insert({
      referral_code: referralCode.code,
      referrer_user_id: referralCode.user_id,
      referred_user_id: user.id,
      status: "registered",
      source: "signup_ref",
      reward_status: "not_eligible_yet",
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ ok: true, status: "already_attributed" });
      }
      throw insertError;
    }

    return NextResponse.json({ ok: true, status: "attributed" });
  } catch (error) {
    console.error("[referrals/attribute][POST]", error);
    return NextResponse.json({ ok: false, reason: "attribution_failed" });
  }
}
