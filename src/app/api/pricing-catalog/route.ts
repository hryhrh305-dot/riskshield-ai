import { NextRequest, NextResponse } from "next/server";
import { getAdminV2CanaryDecision, resolveVerifiedCanaryActor } from "@/lib/admin-v2-canary";
import { buildPricingCatalogResponse } from "@/lib/pricing-catalog-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const actor = await resolveVerifiedCanaryActor(request, process.env);
  const decision = getAdminV2CanaryDecision(actor, process.env);
  const catalog = buildPricingCatalogResponse(decision, process.env);

  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "private, no-store",
      "Vary": "Cookie",
    },
  });
}
