"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

let observerMounted = false;

export function trackE8Event(eventName: string, properties: Record<string, string | number | boolean | null> = {}, idempotencyKey = crypto.randomUUID()) {
  if (!observerMounted) return;
  try {
    void fetch("/api/e8/product-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_name: eventName,
        idempotency_key: idempotencyKey,
        path: window.location.pathname,
        properties,
      }),
    }).catch(() => undefined);
  } catch {
    // Observability is always best effort.
  }
}

export function AttributionObserver() {
  const pathname = usePathname();
  useEffect(() => {
    observerMounted = true;
    try {
      const url = new URL(window.location.href);
      const cid = url.searchParams.get("cid");
      const sessionKey = "secwyn_e8_browser_session";
      const browserSession = sessionStorage.getItem(sessionKey) || crypto.randomUUID();
      sessionStorage.setItem(sessionKey, browserSession);
      const pathKey = url.pathname.slice(0, 64).replace(/[^A-Za-z0-9_-]/g, "_") || "root";
      const acquisitionPage = url.pathname === "/" || url.pathname === "/signup" || url.pathname === "/pricing" || url.pathname === "/sample-audit";
      let sessionReady = false;
      void fetch("/api/e8/attribution/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          cid, path: url.pathname,
          utm_source: url.searchParams.get("utm_source"),
          utm_medium: url.searchParams.get("utm_medium"),
          utm_campaign: url.searchParams.get("utm_campaign"),
          utm_content: url.searchParams.get("utm_content"),
          utm_term: url.searchParams.get("utm_term"),
        }),
      }).then((response) => response.json()).then((result: { landing_key?: string | null }) => {
        sessionReady = true;
        const safeLandingKey = typeof result.landing_key === "string" && /^[A-Za-z0-9_-]{20,120}$/.test(result.landing_key) ? result.landing_key : null;
        const landingIdempotency = cid && safeLandingKey ? `landing:cid:${safeLandingKey}` : `landing:organic:${browserSession}:${pathKey}`;
        if (acquisitionPage) trackE8Event("landing_page_loaded", { js: true }, `page:${safeLandingKey || browserSession}:${pathKey}`);
        if (url.pathname === "/" || cid) {
          trackE8Event("landing_view", {}, `view:${safeLandingKey || browserSession}:${pathKey}`);
          trackE8Event("landing_session_started", { referrer_present: Boolean(document.referrer) }, landingIdempotency);
        }
        if (url.pathname === "/signup") {
          trackE8Event("signup_viewed", {}, `signup-view:${safeLandingKey || browserSession}`);
          trackE8Event("register_page_view", {}, `register-view:${safeLandingKey || browserSession}`);
        }
        if (url.pathname === "/pricing") trackE8Event("pricing_viewed", {}, `pricing-view:${safeLandingKey || browserSession}`);
        if (url.pathname === "/sample-audit") trackE8Event("sample_audit_viewed", {}, `sample-audit-view:${safeLandingKey || browserSession}`);
      }).catch(() => undefined);
      if (cid) {
        url.searchParams.delete("cid");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
      const startedAt = Date.now();
      const onHidden = () => {
        if (document.visibilityState === "hidden") {
          const seconds = Math.min(3600, Math.round((Date.now() - startedAt) / 1000));
          if (sessionReady && seconds >= 2) trackE8Event("landing_engaged", { dwell_seconds: seconds }, `dwell:${browserSession}:${pathKey}`);
        }
      };
      if (acquisitionPage) document.addEventListener("visibilitychange", onHidden, { once: true });
      return () => {
        if (acquisitionPage) document.removeEventListener("visibilitychange", onHidden);
        observerMounted = false;
      };
    } catch {
      return undefined;
    }
  }, [pathname]);
  return null;
}
