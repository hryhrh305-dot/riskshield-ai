import { NextResponse, type NextRequest } from "next/server";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";

const PROJECT_REF = "njhjiavnidssjvnkcxfo";

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

export async function middleware(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const token = cookieHeader ? readAccessTokenFromCookieHeader(cookieHeader, PROJECT_REF) : null;
    const tokenExpired = token ? isJwtExpired(token) : null;
    const isAuthed = Boolean(token) && tokenExpired !== true;

    const path = request.nextUrl.pathname;

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
  matcher: ["/login", "/signup"],
};
