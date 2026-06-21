import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack for production builds (Turbopack is buggy on Vercel)
  // Mark supabase/openai as external to prevent build-time eval errors
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/ssr", "openai"],
};

export default nextConfig;
