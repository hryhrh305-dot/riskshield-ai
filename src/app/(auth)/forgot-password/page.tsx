"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Shield className="w-10 h-10 text-blue-600 mx-auto" />
          <h1 className="text-2xl font-bold mt-3">Reset Password</h1>
          <p className="text-sm text-gray-500 mt-1">We will email you a secure reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          {success && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || cooldown > 0}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Sending..." : cooldown > 0 ? `Send again in ${cooldown}s` : "Send Reset Link"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Back to <Link href="/login" className="text-blue-600 hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
