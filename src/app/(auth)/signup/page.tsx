"use client";

import { useState } from "react";
import { resendSignupConfirmation, signUp } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Shield className="w-10 h-10 text-blue-600 mx-auto" />
          <h1 className="text-2xl font-bold mt-3">Create Account</h1>
          <p className="text-sm text-gray-500 mt-1">Get your free API key</p>
        </div>
        <form onSubmit={handleSignUp} className="bg-white rounded-xl border p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          {successMessage && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{successMessage}</div>}
          {resendMessage && <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">{resendMessage}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="mt-1 text-xs text-gray-400">After signup, you may need to confirm your email before your first login.</p>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{loading ? "Creating..." : "Create Account"}</button>
          {pendingVerificationEmail && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendLoading || resendCooldown > 0}
              className="w-full border border-blue-200 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
            >
              {resendLoading ? "Sending..." : resendCooldown > 0 ? `Resend verification email in ${resendCooldown}s` : "Resend verification email"}
            </button>
          )}
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Sign In</Link></p>
      </div>
    </div>
  );
}
