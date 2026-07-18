"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trackE8Event } from "@/components/e8/AttributionObserver";
import { createClient } from "@/lib/supabase";

export function SampleAuditActions({ location }: { location: "hero" | "summary" | "footer" }) {
  const [primaryHref, setPrimaryHref] = useState("/signup?source=sample-audit");

  useEffect(() => {
    if (location === "hero") trackE8Event("sample_audit_viewed", { location });
    void (async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession();
        if (session?.user) setPrimaryHref("/risk-check");
      } catch {
        setPrimaryHref("/signup?source=sample-audit");
      }
    })();
  }, [location]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link
        href={primaryHref}
        onClick={() => trackE8Event("sample_audit_primary_cta_clicked", { location, destination: primaryHref === "/risk-check" ? "contact_check" : "signup" })}
        className="rs-button-primary rs-link-arrow inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
      >
        Start with 50 Free Checks <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <Link
        href="/pricing"
        onClick={() => trackE8Event("sample_audit_pricing_clicked", { location })}
        className="rs-button-secondary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
      >
        See Pricing
      </Link>
    </div>
  );
}
