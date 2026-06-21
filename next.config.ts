import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/ssr", "openai"],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
