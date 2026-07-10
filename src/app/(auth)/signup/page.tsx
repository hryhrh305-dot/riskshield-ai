"use client";

import { useEffect, useState } from "react";
import { resendSignupConfirmation, signUp } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";

const REFERRAL_STORAGE_KEY = "secwyn_referral_code";
const REFERRAL_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeReferralCode(value: string | null) {
  return (value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = normalizeReferralCode(params.get("ref"));
    if (!ref) return;

    localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({
        code: ref,
        expiresAt: Date.now() + REFERRAL_MAX_AGE_MS,
      }),
    );
  }, []);

  function startResendCooldown() {
    setResendCooldown(60);
    const timer = window.setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");
    setResendMessage("");
    setPendingVerificationEmail("");

    const checkRes = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const checkData = await checkRes.json().catch(() => null);

    if (!checkRes.ok) {
      setError(checkData?.error || "We could not verify this email right now. Please try again in a moment.");
      setLoading(false);
      return;
    }

    if (checkData?.exists) {
      if (checkData.confirmed) {
        setError("This email is already registered. Please sign in instead.");
      } else {
        setPendingVerificationEmail(email);
        setSuccessMessage(`This email is already registered but not confirmed. Please check ${email} and click the verification link.`);
        startResendCooldown();
      }
      setLoading(false);
      return;
    }

    const { data, error } = await signUp(email, password);
    if (error) {
      const normalizedMessage = error.message?.toLowerCase() || "";
      if (
        normalizedMessage.includes("already") ||
        normalizedMessage.includes("exists") ||
        normalizedMessage.includes("registered") ||
        normalizedMessage.includes("user already")
      ) {
        setError("This email is already registered. Please sign in instead.");
      } else {
        setError(error.message);
      }
    } else if (data?.session) {
      router.push("/dashboard");
    } else {
      setPendingVerificationEmail(email);
      setSuccessMessage(`Verification email sent to ${email}. Please open your inbox, click the confirmation link, then sign in to continue.`);
      startResendCooldown();
    }
    setLoading(false);
  }

  async function handleResendVerification() {
    if (!pendingVerificationEmail || resendCooldown > 0) return;
    setResendLoading(true);
    setError("");
    setResendMessage("");
    const { error } = await resendSignupConfirmation(pendingVerificationEmail);
    if (error) {
      setError(error.message);
    } else {
      setResendMessage(`A new verification email was sent to ${pendingVerificationEmail}.`);
      startResendCooldown();
    }
    setResendLoading(false);
  }

  return (
    <div className="rs-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="rs-fade-up inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="rs-title-settle mt-4 text-3xl font-semibold text-white">Create Account</h1>
          <p className="rs-fade-up rs-fade-up-delay-1 mt-2 text-sm text-slate-400">Start with your free Secwyn account</p>
        </div>

        <form onSubmit={handleSignUp} className="rs-card rs-card-hover space-y-4 rounded-[28px] p-6 sm:p-7">
          {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
          {successMessage && (
            <div className="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">
              <div className="text-emerald-200">{successMessage}</div>
              <div className="font-medium text-red-200">
                If you cannot find the verification email, please check your spam folder. It may have been filtered by mistake.
              </div>
            </div>
          )}
          {resendMessage && <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">{resendMessage}</div>}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="rs-input px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="rs-input px-4 py-3 text-sm" />
            <p className="mt-1 text-xs text-slate-500">After signup, you may need to confirm your email before your first login.</p>
          </div>
          <button type="submit" disabled={loading} className="rs-button-primary rs-link-arrow flex min-h-11 w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50">{loading ? "Creating..." : "Create Account"}</button>
          {pendingVerificationEmail && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendLoading || resendCooldown > 0}
              className="min-h-11 w-full rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
            >
              {resendLoading ? "Sending..." : resendCooldown > 0 ? `Resend verification email in ${resendCooldown}s` : "Resend verification email"}
            </button>
          )}
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-medium text-white hover:text-slate-200">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
