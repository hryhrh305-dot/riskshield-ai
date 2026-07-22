import { NextResponse } from "next/server";
import { requireAffiliateUser, loadAffiliateBalance, loadAffiliateMembership } from "@/modules/affiliate/application/server";
import { affiliateFlagEnabled } from "@/modules/affiliate";

export async function GET() {
  if(!affiliateFlagEnabled(process.env,"AFFILIATE_PROVISIONAL_ACTIVATION")) return NextResponse.json({error:"Not found."},{status:404});
  try {
    const user = await requireAffiliateUser();
    const membership = await loadAffiliateMembership(user.id);
    const balance = membership ? await loadAffiliateBalance(membership.id) : 0n;
    return NextResponse.json({ membership: membership ? { id: membership.id, status: membership.status, affiliateCode: membership.affiliate_code, publicAlias: membership.public_alias } : null, balanceMinor: balance.toString(), currency: "USD" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "AFFILIATE_AUTH_REQUIRED" ? "Authentication required." : "Affiliate account unavailable." }, { status: error instanceof Error && error.message === "AFFILIATE_AUTH_REQUIRED" ? 401 : 500 });
  }
}
