"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { updatePassword } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [confirmationUrl, setConfirmationUrl] = useState("");
  const [recoveryTokenHash, setRecoveryTokenHash] = useState("");
  const [verifyingRecovery, setVerifyingRecovery] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const incomingConfirmationUrl = urlParams.get("confirmation_url");
    const incomingTokenHash = urlParams.get("token_hash");
    const incomingType = urlParams.get("type");
    const supabase = createClient();
    const presetError = urlParams.get("message");
    const hasRecoveryHash =
      window.location.hash.includes("access_token=") ||
      window.location.hash.includes("refresh_token=") ||
      window.location.hash.includes("type=recovery");

    if (incomingTokenHash && incomingType === "recovery") {
      setRecoveryTokenHash(incomingTokenHash);
      setCheckingSession(false);
      window.history.replaceState(null, "", "/reset-password");
      return;
    }

    if (incomingConfirmationUrl && !hasRecoveryHash) {
      const rebuiltConfirmationUrl = rebuildConfirmationUrl(incomingConfirmationUrl, urlParams);
      setConfirmationUrl(rebuiltConfirmationUrl);
      setCheckingSession(false);
      return;
    }

    async function checkRecoverySession() {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setError("");
          setCheckingSession(false);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      if (presetError) {
        setError(presetError);
      } else {
        setError("Your reset link is invalid or expired. Please request a new password reset email.");
      }
      setCheckingSession(false);
    }

    checkRecoverySession();
  }, []);

  function rebuildConfirmationUrl(rawUrl: string, params: URLSearchParams) {
    try {
      const url = new URL(rawUrl);
      for (const [key, value] of params.entries()) {
        if (key === "confirmation_url" || key === "error" || key === "message") continue;
        if (!url.searchParams.has(key)) {
          url.searchParams.set(key, value);
        }
      }
      return url.toString();
    } catch {
      return rawUrl;
    }
  }

  function handleContinueFromEmail() {
    if (!confirmationUrl) return;
    window.location.href = confirmationUrl;
  }

  async function handleVerifyRecoveryToken() {
    if (!recoveryTokenHash) return;
    setVerifyingRecovery(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: recoveryTokenHash,
    });

    if (error) {
      setError("Password reset link is invalid or expired. Please request a new one.");
      setRecoveryTokenHash("");
      setVerifyingRecovery(false);
      return;
    }

    setRecoveryTokenHash("");
    setCheckingSession(false);
    setVerifyingRecovery(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess("Password updated successfully. Redirecting to Sign In...");
    setLoading(false);
    setTimeout(() => {
      router.push("/login");
    }, 1500);
  }

  return (
    <div className="rs-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="rs-fade-up inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="rs-title-settle mt-4 text-3xl font-semibold text-white">Choose New Password</h1>
          <p className="rs-fade-up rs-fade-up-delay-1 mt-2 text-sm text-slate-400">Set a new password for your Secwyn account.</p>
        </div>

        {recoveryTokenHash ? (
          <div className="rs-card rs-card-hover space-y-4 rounded-[28px] p-6 sm:p-7">
            {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">
              Click the button below to verify your reset link and choose a new password.
            </div>
            <button
              type="button"
              onClick={handleVerifyRecoveryToken}
              disabled={verifyingRecovery}
              className="rs-button-primary rs-link-arrow flex min-h-11 w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50"
            >
              {verifyingRecovery ? "Verifying..." : "Continue to Reset Password"}
            </button>
          </div>
        ) : confirmationUrl ? (
          <div className="rs-card rs-card-hover space-y-4 rounded-[28px] p-6 sm:p-7">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">
              To protect your reset link from email security scanners, please click the button below to continue securely to your password reset form.
            </div>
            <button
              type="button"
              onClick={handleContinueFromEmail}
              className="rs-button-primary rs-link-arrow flex min-h-11 w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium"
            >
              Continue to Reset Password
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="rs-card rs-card-hover space-y-4 rounded-[28px] p-6 sm:p-7">
          {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
          {success && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div>}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required
              disabled={checkingSession}
              className="rs-input px-4 py-3 text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={10}
              required
              disabled={checkingSession}
              className="rs-input px-4 py-3 text-sm disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || checkingSession || !!success}
            className="rs-button-primary rs-link-arrow flex min-h-11 w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50"
          >
            {checkingSession ? "Checking link..." : loading ? "Updating..." : "Update Password"}
          </button>
        </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-500">
          Back to <Link href="/login" className="font-medium text-white hover:text-slate-200">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
