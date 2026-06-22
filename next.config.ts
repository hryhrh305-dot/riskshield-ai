import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/ssr", "openai", "pg"],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
