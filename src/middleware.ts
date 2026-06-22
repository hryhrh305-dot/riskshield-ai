import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  try {
    const res = NextResponse.next({ request });

    // Read auth token from cookie directly (same as API routes)
    const cookieHeader = request.headers.get("cookie") || "";
    let userId: string | null = null;
    if (cookieHeader) {
      const cookies: Record<string, string> = {};
      cookieHeader.split(";").forEach((c) => {
        const [k, ...v] = c.trim().split("=");
        if (k) cookies[k.trim()] = decodeURIComponent(v.join("="));
      });
      const rawToken = cookies["sb-njhjiavnidssjvnkcxfo-auth-token"] || cookies["sb-access-token"];
      if (rawToken) {
        let token = rawToken;
        try {
          const parsed = JSON.parse(rawToken);
          token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || parsed);
        } catch { /* raw string */ }
        // Verify token via Supabase REST API
        const userRes = await fetch("https://njhjiavnidssjvnkcxfo.supabase.co/auth/v1/user", {
          headers: { "Authorization": "Bearer " + token, "apikey": "sb_publishable_6pS7tKkxxBqYTLcAUu_GPg_0BysHHx8" }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          userId = userData?.id || null;
        }
      }
    }

    const path = request.nextUrl.pathname;

    if ((path.startsWith("/dashboard") || path.startsWith("/pricing") || path.startsWith("/risk-check") || path.startsWith("/bulk-check") || path.startsWith("/blacklist") || path.startsWith("/pre-send")) && !userId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if ((path === "/login" || path === "/signup") && userId) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return res;
  } catch (e) {
    console.error("[middleware] error:", e);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/pricing/:path*", "/risk-check/:path*", "/bulk-check/:path*", "/blacklist/:path*", "/login", "/signup"],
};
