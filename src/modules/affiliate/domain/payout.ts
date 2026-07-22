import type { Money } from "./types";

export type PayoutGateInput = Readonly<{
  balance: Money;
  minimumMinor: bigint;
  reconciliationMatched: boolean;
  batchFrozenForHours: number;
  payoutAccountVerified: boolean;
  killSwitch: boolean;
  openHighSeverityIncident: boolean;
  reauthenticated: boolean;
  pinOrOtpVerified: boolean;
}>;

export function evaluatePayoutGate(input: PayoutGateInput) {
  const reasons: string[] = [];
  if (input.killSwitch) reasons.push("KILL_SWITCH");
  if (input.openHighSeverityIncident) reasons.push("HIGH_SEVERITY_INCIDENT");
  if (!input.reconciliationMatched) reasons.push("RECONCILIATION_MISMATCH");
  if (input.batchFrozenForHours < 72) reasons.push("FREEZE_WINDOW_INCOMPLETE");
  if (!input.payoutAccountVerified) reasons.push("PAYOUT_ACCOUNT_UNVERIFIED");
  if (!input.reauthenticated) reasons.push("REAUTH_REQUIRED");
  if (!input.pinOrOtpVerified) reasons.push("PAYOUT_VERIFICATION_REQUIRED");
  if (input.balance.amountMinor < input.minimumMinor) reasons.push("BELOW_MINIMUM");
  return Object.freeze({ allowed: reasons.length === 0, reasons: Object.freeze(reasons) });
}

