"use client";

import { useState } from "react";
import { signUp } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");
    const { data, error } = await signUp(email, password);
    if (error) {
      if (error.message?.includes("already") || error.message?.includes("exists")) {
        setError("This email is already registered. Please sign in instead.");
      } else {
        setError(error.message);
      }
    } else if (data?.session) {
      router.push("/dashboard");
    } else {
      setSuccessMessage(`Verification email sent to ${email}. Please open your inbox, click the confirmation link, then sign in to continue.`);
    }
    setLoading(false);
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
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Sign In</Link></p>
      </div>
    </div>
  );
}
