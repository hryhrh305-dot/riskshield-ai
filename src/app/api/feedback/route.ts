import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";

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

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  _supabaseAdmin = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _supabaseAdmin;
}

async function getUserFromRequest(request: NextRequest) {
  try {
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
  const { count, error } = await getSupabaseAdmin()
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
    const sentToday = await getTodayFeedbackCount(user.id);
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

    const { error } = await getSupabaseAdmin().from("feedback_messages").insert({
      user_id: user.id,
      email: user.email,
      subject,
      message,
    });

    if (error) {
      throw error;
    }

    const nextSentToday = sentToday + 1;

    return NextResponse.json({
      success: true,
      sentToday: nextSentToday,
      dailyLimit: DAILY_FEEDBACK_LIMIT,
      remainingToday: Math.max(0, DAILY_FEEDBACK_LIMIT - nextSentToday),
      message: "Feedback sent successfully.",
    });
  } catch (error) {
    console.error("[feedback][POST]", error);
    return NextResponse.json({ error: "Failed to send feedback." }, { status: 500 });
  }
}
