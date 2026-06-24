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
      if (type === "recovery") {
        loginUrl.searchParams.set("error", "verification_failed");
        loginUrl.searchParams.set(
          "message",
          "Password reset link is invalid or expired. Please request a new one."
        );
      } else {
        loginUrl.searchParams.set("status", "info");
        loginUrl.searchParams.set(
          "message",
          "This email confirmation link may already have been used. If your account is already confirmed, please sign in. Otherwise, request a new verification email."
        );
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
