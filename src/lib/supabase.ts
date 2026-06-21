import { createBrowserClient } from "@supabase/ssr";

const FALLBACK_SUPABASE_URL = "https://njhjiavnidssjvnkcxfo.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qaGppYXZuaWRzc2p2bmtjeGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNzgzMjksImV4cCI6MjA2NDg1NDMyOX0.E8b6RCAEMUfhScziY_ZTrfznMfp8pf79FfSa8wVnsCk";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Supabase URL or Anon Key is missing!");
  }
  return createBrowserClient(url || FALLBACK_SUPABASE_URL, key || FALLBACK_SUPABASE_ANON_KEY);
}
