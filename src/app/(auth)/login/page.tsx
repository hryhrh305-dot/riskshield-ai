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
    const reason = params.get("reason");

    if (message) {
      setError(message);
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
    setResendMessage("");
    setShowResendVerification(false);
    const { data, error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      if (error.message?.toLowerCase().includes("email not confirmed")) {
        setShowResendVerification(true);
      }
    }
    else if (data?.session) router.push("/dashboard");
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Shield className="w-10 h-10 text-blue-600 mx-auto" />
          <h1 className="text-2xl font-bold mt-3">Sign In</h1>
          <p className="text-sm text-gray-500 mt-1">RiskShield AI</p>
        </div>
        <form onSubmit={handleLogin} className="bg-white rounded-xl border p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          {resendMessage && <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">{resendMessage}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{loading ? "Signing in..." : "Sign In"}</button>
          {showResendVerification && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendLoading || resendCooldown > 0 || !email}
              className="w-full border border-blue-200 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
            >
              {resendLoading ? "Sending..." : resendCooldown > 0 ? `Resend verification email in ${resendCooldown}s` : "Resend verification email"}
            </button>
          )}
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">No account? <Link href="/signup" className="text-blue-600 hover:underline">Sign Up</Link></p>
      </div>
    </div>
  );
}
