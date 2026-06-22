import { createBrowserClient } from "@supabase/ssr";

const FALLBACK_SUPABASE_URL = "https://njhjiavnidssjvnkcxfo.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_6pS7tKkxxBqYTLcAUu_GPg_0BysHHx8";

let _supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!_supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
    _supabaseClient = createBrowserClient(url || FALLBACK_SUPABASE_URL, key || FALLBACK_SUPABASE_ANON_KEY);
  }
  return _supabaseClient;
}
