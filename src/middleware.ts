import { NextResponse, type NextRequest } from "next/server";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";

export async function middleware(request: NextRequest) {
  try {
    const res = NextResponse.next({ request });

    const cookieHeader = request.headers.get("cookie") || "";
    let userId: string | null = null;
    if (cookieHeader) {
      const token = readAccessTokenFromCookieHeader(cookieHeader, "njhjiavnidssjvnkcxfo");
      if (token) {
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
  matcher: ["/dashboard/:path*", "/pricing/:path*", "/risk-check/:path*", "/bulk-check/:path*", "/blacklist/:path*", "/pre-send/:path*", "/login", "/signup"],
};
