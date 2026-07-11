"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SecwynMark } from "@/components/brand/SecwynMark";
import { requestPasswordReset } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const cooldownStorageKey = "riskshield_reset_cooldown_until";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const storedUntil = window.localStorage.getItem(cooldownStorageKey);
    if (storedUntil) {
      const remaining = Math.max(0, Math.ceil((Number(storedUntil) - Date.now()) / 1000));
      if (remaining > 0) {
        startCooldown(remaining);
      } else {
        window.localStorage.removeItem(cooldownStorageKey);
      }
    }

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  function startCooldown(seconds = 60) {
    setCooldown(seconds);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          window.localStorage.removeItem(cooldownStorageKey);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const { error } = await requestPasswordReset(email);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(`Password reset email sent to ${email}. Please open the email and follow the link to set a new password.`);
      window.localStorage.setItem(cooldownStorageKey, String(Date.now() + 60_000));
      startCooldown();
    }

    setLoading(false);
  }

  return (
    <div className="rs-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="rs-fade-up inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <SecwynMark className="h-7 w-7 text-white" />
          </div>
          <h1 className="rs-title-settle mt-4 text-3xl font-semibold text-white">Reset Password</h1>
          <p className="rs-fade-up rs-fade-up-delay-1 mt-2 text-sm text-slate-400">We will email you a secure reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="rs-card rs-card-hover space-y-4 rounded-[28px] p-6 sm:p-7">
          {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
          {success && (
            <div className="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">
              <div className="text-emerald-200">{success}</div>
              {cooldown > 0 && (
                <div className="font-medium text-amber-200">
                  For security, you can request another reset email in {cooldown}s.
                </div>
              )}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rs-input px-4 py-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || cooldown > 0}
            className="rs-button-primary rs-link-arrow flex min-h-11 w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Sending..." : cooldown > 0 ? `Send again in ${cooldown}s` : "Send Reset Link"}
          </button>
          {cooldown > 0 && (
            <p className="text-center text-sm font-medium text-slate-500">
              Please wait {cooldown}s before requesting another reset email.
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Back to <Link href="/login" className="font-medium text-white hover:text-slate-200">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
