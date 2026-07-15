import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectRef, readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
const PROJECT_REF = getSupabaseProjectRef(SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || "";
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return atob(padded);
  } catch {
    return null;
  }
}

function isJwtExpired(token: string): boolean | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  const payloadText = decodeBase64Url(parts[1]);
  if (!payloadText) return null;

  try {
    const payload = JSON.parse(payloadText) as { exp?: number };
    if (typeof payload.exp !== "number") return null;
    return Date.now() / 1000 >= payload.exp;
  } catch {
    return null;
  }
}

async function isValidSessionToken(token: string): Promise<boolean> {
  try {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    }
    const { data: { user }, error } = await _supabaseAdmin.auth.getUser(token);
    return !error && !!user;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const token = cookieHeader ? readAccessTokenFromCookieHeader(cookieHeader, PROJECT_REF) : null;
    const tokenExpired = token ? isJwtExpired(token) : null;
    const isAuthed = Boolean(token) && tokenExpired !== true && await isValidSessionToken(token);

    const path = request.nextUrl.pathname;

    const protectedPaths = [
      "/dashboard",
      "/risk-check",
      "/bulk-check",
      "/pre-send",
      "/blacklist",
    ];

    if (protectedPaths.some((protectedPath) => path === protectedPath || path.startsWith(protectedPath + "/"))) {
      if (!isAuthed) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("reason", "invalid_session");
        loginUrl.searchParams.set("next", path);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }

    if ((path === "/login" || path === "/signup") && isAuthed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch (e) {
    console.error("[middleware] error:", e);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/login", "/signup", "/dashboard/:path*", "/risk-check/:path*", "/bulk-check/:path*", "/pre-send/:path*", "/blacklist/:path*"],
};
