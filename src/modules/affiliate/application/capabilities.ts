export const AFFILIATE_CAPABILITIES = Object.freeze({
  publicProgram: "affiliate.public",
  application: "affiliate.application",
  activation: "affiliate.activation",
  attribution: "affiliate.attribution",
  commissionShadow: "affiliate.commission.shadow",
  realCommission: "affiliate.commission.real",
  teams: "affiliate.teams",
  payout: "affiliate.payout",
  telegram: "affiliate.telegram",
  contentAdmin: "affiliate.content.admin",
} as const);

export type AffiliateCapability = (typeof AFFILIATE_CAPABILITIES)[keyof typeof AFFILIATE_CAPABILITIES];

export function hasCapability(grants: readonly string[], requested: AffiliateCapability) {
  return grants.includes(requested);
}

