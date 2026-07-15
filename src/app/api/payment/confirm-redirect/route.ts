import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";
import { findPlanByCreemProductId, verifyCreemRedirectSignature } from "@/lib/creem";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const CREEM_API_KEY = process.env.CREEM_API_KEY || "";
const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET || "";

function diagnoseRedirectSignature(rawQuery: string) {
  const params = new URLSearchParams(rawQuery);
  const signature = params.get("signature") || "";
  const entries = Array.from(params.entries()).filter(
    ([key, value]) => key !== "signature" && value !== "" && value !== "null",
  );
  const documentedOrder = ["checkout_id", "order_id", "customer_id", "subscription_id", "product_id", "request_id"];
  const fixedEntries = documentedOrder.flatMap((key) => entries.filter(([entryKey]) => entryKey === key));
  const sortedEntries = [...entries].sort(([left], [right]) => left.localeCompare(right));
  const candidates = [
    ["sorted-amp", sortedEntries.map(([key, value]) => `${key}=${value}`).join("&")],
    ["fixed-amp", fixedEntries.map(([key, value]) => `${key}=${value}`).join("&")],
    ["ordered-amp", entries.map(([key, value]) => `${key}=${value}`).join("&")],
    ["fixed-pipe", fixedEntries.map(([key, value]) => `${key}=${value}`).join("|")],
    ["ordered-pipe", entries.map(([key, value]) => `${key}=${value}`).join("|")],
  ] as const;
  const keys = [["api", CREEM_API_KEY], ["webhook", CREEM_WEBHOOK_SECRET]] as const;
  const matches: string[] = [];
  for (const [keyName, secret] of keys) {
    if (!secret) continue;
    for (const [candidateName, candidate] of candidates) {
      if (crypto.createHmac("sha256", secret).update(candidate).digest("hex") === signature) {
        matches.push(`${keyName}:hmac:${candidateName}`);
      }
      if (crypto.createHash("sha256").update(`${candidate}|salt=${secret}`).digest("hex") === signature) {
        matches.push(`${keyName}:hash-salt:${candidateName}`);
      }
    }
  }
  return matches;
}

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
      const matches = diagnoseRedirectSignature(rawQuery);
      console.warn("[creem-redirect-signature-diagnostic]", { matches });
      return NextResponse.json({
        error: "Invalid redirect signature.",
        ...(process.env.VERCEL_ENV === "preview" ? { diagnosticMatches: matches } : {}),
      }, { status: 401 });
    }

    const params = new URLSearchParams(rawQuery);
    const checkoutId = params.get("checkout_id");
    const productId = params.get("product_id");

    if (!checkoutId || !productId) {
      return NextResponse.json({ error: "Missing checkout context." }, { status: 400 });
    }

    const paymentAdmin = getSupabaseAdmin();
    const { data: paymentRow, error: paymentError } = await paymentAdmin
      .from("payments")
      .select("id, plan, status")
      .eq("user_id", user.id)
      .eq("provider", "creem")
      .eq("provider_checkout_id", checkoutId)
      .maybeSingle();
    if (paymentError) throw paymentError;

    if (!paymentRow) {
      return NextResponse.json({ error: "Matching payment record not found." }, { status: 404 });
    }

    const resolvedPlan = findPlanByCreemProductId(productId) || paymentRow.plan || "starter";
    if (paymentRow.status !== "completed") {
      return NextResponse.json({ success: false, pending: true, paymentStatus: paymentRow.status }, { status: 202 });
    }
    const { data: profileRow, error: profileError } = await paymentAdmin.from("profiles")
      .select("plan,subscription_status").eq("id",user.id).maybeSingle();
    if (profileError) throw profileError;
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
