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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const presetError = new URLSearchParams(window.location.search).get("message");

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Shield className="w-10 h-10 text-blue-600 mx-auto" />
          <h1 className="text-2xl font-bold mt-3">Choose New Password</h1>
          <p className="text-sm text-gray-500 mt-1">Set a new password for your RiskShield AI account.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          {success && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required
              disabled={checkingSession}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={10}
              required
              disabled={checkingSession}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || checkingSession || !!success}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {checkingSession ? "Checking link..." : loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Back to <Link href="/login" className="text-blue-600 hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
