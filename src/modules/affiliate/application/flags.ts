export const AFFILIATE_FLAG_ORDER = [
  "AFFILIATE_PUBLIC_PAGE",
  "AFFILIATE_APPLICATIONS",
  "AFFILIATE_PROVISIONAL_ACTIVATION",
  "AFFILIATE_ATTRIBUTION",
  "AFFILIATE_COMMISSION_SHADOW",
  "AFFILIATE_COMMISSION_REAL",
  "AFFILIATE_TEAM_REWARDS",
  "AFFILIATE_PAYOUT_CREATION",
  "AFFILIATE_PAYOUT_EXECUTION",
  "AFFILIATE_TELEGRAM_DAILY",
] as const;

export type AffiliateFlag = (typeof AFFILIATE_FLAG_ORDER)[number];
export type AffiliateOperationalFlag = "AFFILIATE_CONTENT_ADMIN"|"AFFILIATE_TELEGRAM_WINS"|"AFFILIATE_TELEGRAM_PAYOUT_NOTICE"|"AFFILIATE_ADMIN";

export function affiliateFlagEnabled(env: Readonly<Record<string,string|undefined>>, flag: AffiliateFlag) {
  if (env.AFFILIATE_KILL_SWITCH === "true") return false;
  const index = AFFILIATE_FLAG_ORDER.indexOf(flag);
  return env[flag] === "true" && AFFILIATE_FLAG_ORDER.slice(0, index).every((required) => env[required] === "true");
}

export function affiliateOperationalFlagEnabled(env:Readonly<Record<string,string|undefined>>,flag:AffiliateOperationalFlag){return env.AFFILIATE_KILL_SWITCH!=="true"&&env[flag]==="true";}

export function assertAffiliateFlagSequence(env: Readonly<Record<string,string|undefined>>) {
  let disabledSeen = false;
  for (const flag of AFFILIATE_FLAG_ORDER) {
    const enabled = env[flag] === "true";
    if (enabled && disabledSeen) throw new Error("AFFILIATE_FLAG_SEQUENCE_INVALID");
    if (!enabled) disabledSeen = true;
  }
}
