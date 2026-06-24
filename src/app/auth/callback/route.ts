import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? (type === "recovery" ? "/reset-password" : "/dashboard");

  if (code || tokenHash) {
    const supabase = await createServerSupabaseClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          type: (type as "email" | "signup" | "recovery" | "invite" | "magiclink" | "email_change") || "email",
          token_hash: tokenHash || "",
        });

    if (error) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", "verification_failed");
      loginUrl.searchParams.set(
        "message",
        type === "recovery"
          ? "Password reset link is invalid or expired. Please request a new one."
          : "Email verification failed or the link has expired. Please request a new email and try again."
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
