export type AffiliateActivationEvent =
  | "referred_registration"
  | "verified_opportunity"
  | "first_payment";

export type AffiliateActivationEvidence = Readonly<{
  actions: ReadonlyArray<Readonly<{ actionType: string; format: string }>>;
  eventTypes: ReadonlyArray<AffiliateActivationEvent>;
  graceUsed: boolean;
  expired?: boolean;
}>;

export type AffiliateActivationResult = Readonly<{
  eligible: boolean;
  reason: "actions" | AffiliateActivationEvent | "grace_available" | "expired" | "in_progress";
}>;

export function evaluateAffiliateActivation(evidence: AffiliateActivationEvidence): AffiliateActivationResult {
  for (const shortcut of ["first_payment", "verified_opportunity", "referred_registration"] as const) {
    if (evidence.eventTypes.includes(shortcut)) return Object.freeze({ eligible: true, reason: shortcut });
  }

  const actions = new Set(evidence.actions.map((item) => item.actionType));
  const formats = new Set(evidence.actions.map((item) => item.format));
  if (actions.size >= 3 && formats.size >= 2) return Object.freeze({ eligible: true, reason: "actions" });
  if (evidence.expired) {
    return Object.freeze({ eligible: false, reason: evidence.graceUsed ? "expired" : "grace_available" });
  }
  return Object.freeze({ eligible: false, reason: "in_progress" });
}
