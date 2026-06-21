import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack for builds on Vercel (more stable than Turbopack)
  turbopack: {
    // keep turbopack for dev only
  },
  // Mark supabase as external to avoid build-time eval
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/ssr", "openai"],
};

export default nextConfig;
