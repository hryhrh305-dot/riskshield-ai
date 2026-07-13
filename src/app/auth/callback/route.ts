import { after, NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { recordAuthCompletionBestEffort } from "@/lib/e8/server";

export async function GET(request: NextRequest) {
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
      if (type === "recovery") {
        const resetUrl = new URL("/reset-password", origin);
        resetUrl.searchParams.set("error", "verification_failed");
        resetUrl.searchParams.set("message", "Password reset link is invalid or expired. Please request a new one.");
        return NextResponse.redirect(resetUrl);
      }
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("status", "info");
      loginUrl.searchParams.set("message", "This email confirmation link may already have been used. If your account is already confirmed, please sign in. Otherwise, request a new verification email.");
      return NextResponse.redirect(loginUrl);
    }

    // Recovery and all non-signup OTP types retain their original redirect-only behavior.
    if (type === "signup" || type === "email") {
      after(async () => {
        try {
          const { data } = await supabase.auth.getUser();
          if (data.user) await recordAuthCompletionBestEffort(request, data.user.id);
        } catch {
          // Verification redirects never depend on E8 observability.
        }
      });
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
