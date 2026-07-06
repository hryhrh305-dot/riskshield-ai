"use client";

import { useEffect, useState } from "react";
import { resendSignupConfirmation, signIn } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const router = useRouter();

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message");
    const errorCode = params.get("error");
    const status = params.get("status");
    const reason = params.get("reason");

    if (message) {
      if (status === "info") {
        setInfoMessage(message);
      } else {
        setError(message);
      }
      return;
    }

    if (errorCode === "verification_failed") {
      setError("Email verification failed or the link has expired. Please request a new email and try again.");
      return;
    }

    if (reason === "invalid_session") {
      setError("Your session expired or became invalid. Please sign in again.");
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfoMessage("");
    setResendMessage("");
    setShowResendVerification(false);
    const { data, error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      if (error.message?.toLowerCase().includes("email not confirmed")) {
        setShowResendVerification(true);
      }
    }
    else if (data?.session) window.location.href = "/dashboard";
    setLoading(false);
  }

  async function handleResendVerification() {
    if (!email || resendCooldown > 0) return;
    setResendLoading(true);
    setError("");
    setResendMessage("");
    const { error } = await resendSignupConfirmation(email);
    if (error) {
      setError(error.message);
    } else {
      setResendMessage(`A new verification email was sent to ${email}.`);
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
          <h1 className="rs-title-settle mt-4 text-3xl font-semibold text-white">Sign In</h1>
          <p className="rs-fade-up rs-fade-up-delay-1 mt-2 text-sm text-slate-400">Access your Secwyn workspace</p>
        </div>

        <form onSubmit={handleLogin} className="rs-card rs-card-hover space-y-4 rounded-[28px] p-6 sm:p-7">
          {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
          {infoMessage && <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">{infoMessage}</div>}
          {resendMessage && <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">{resendMessage}</div>}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="rs-input px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="rs-input px-4 py-3 text-sm" />
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">Need to change your password?</span>
            <Link href="/forgot-password" className="font-medium text-white hover:text-slate-200">
              Reset password
            </Link>
          </div>
          <button type="submit" disabled={loading} className="rs-button-primary rs-link-arrow flex min-h-11 w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50">{loading ? "Signing in..." : "Sign In"}</button>
          {showResendVerification && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendLoading || resendCooldown > 0 || !email}
              className="min-h-11 w-full rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
            >
              {resendLoading ? "Sending..." : resendCooldown > 0 ? `Resend verification email in ${resendCooldown}s` : "Resend verification email"}
            </button>
          )}
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          No account? <Link href="/signup" className="font-medium text-white hover:text-slate-200">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
