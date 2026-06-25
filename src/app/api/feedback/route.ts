import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const DAILY_FEEDBACK_LIMIT = 3;

function getProjectRef() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

async function getUserFromRequest(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

function getUtcDayStartIso() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

async function getTodayFeedbackCount(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("feedback_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", getUtcDayStartIso());

  if (error) throw error;
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sentToday = await getTodayFeedbackCount(user.id);

    return NextResponse.json({
      sentToday,
      dailyLimit: DAILY_FEEDBACK_LIMIT,
      remainingToday: Math.max(0, DAILY_FEEDBACK_LIMIT - sentToday),
    });
  } catch (error) {
    console.error("[feedback][GET]", error);
    return NextResponse.json({ error: "Failed to load feedback quota." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { subject?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();

  if (subject.length < 4 || subject.length > 120) {
    return NextResponse.json({ error: "Subject must be 4-120 characters." }, { status: 400 });
  }

  if (message.length < 10 || message.length > 2000) {
    return NextResponse.json({ error: "Feedback message must be 10-2000 characters." }, { status: 400 });
  }

  try {
    let sentToday = 0;
    let quotaLookupFailed = false;
    try {
      sentToday = await getTodayFeedbackCount(user.id);
      if (sentToday >= DAILY_FEEDBACK_LIMIT) {
        return NextResponse.json(
          {
            error: `Daily feedback limit reached (${DAILY_FEEDBACK_LIMIT}/day). Please try again tomorrow.`,
            sentToday,
            dailyLimit: DAILY_FEEDBACK_LIMIT,
            remainingToday: 0,
          },
          { status: 429 },
        );
    }
    } catch (quotaError) {
      quotaLookupFailed = true;
      console.warn("[feedback][POST][quota]", quotaError);
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("feedback_messages").insert({
      user_id: user.id,
      email: user.email,
      subject,
      message,
    });

    if (error) {
      console.error("[feedback][POST][insert]", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        {
          error: error.message || "Failed to send feedback.",
          code: error.code ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
          quotaLookupFailed,
        },
        { status: 500 },
      );
    }

    const nextSentToday = sentToday + 1;

    return NextResponse.json({
      success: true,
      sentToday: nextSentToday,
      dailyLimit: DAILY_FEEDBACK_LIMIT,
      remainingToday: Math.max(0, DAILY_FEEDBACK_LIMIT - nextSentToday),
      message: "Feedback sent successfully.",
      quotaLookupFailed,
    });
  } catch (error) {
    const err = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error("[feedback][POST]", err);
    return NextResponse.json(
      {
        error: err?.message || "Failed to send feedback.",
        code: err?.code || null,
        details: err?.details || null,
        hint: err?.hint || null,
        quotaLookupFailed: false,
      },
      { status: 500 },
    );
  }
}
