export type TestCanarySuccessState =
  | "redirect_unverified"
  | "webhook_pending"
  | "provisioning_pending"
  | "confirmed"
  | "failed";

export function resolveTestCanarySuccessState(input: {
  redirectVerified: boolean;
  paymentStatus?: string | null;
  subscriptionActive?: boolean;
  creditGrantRecorded?: boolean;
}): TestCanarySuccessState {
  if (!input.redirectVerified) return "redirect_unverified";
  if (input.paymentStatus === "failed" || input.paymentStatus === "refunded" || input.paymentStatus === "disputed") {
    return "failed";
  }
  if (input.paymentStatus !== "completed") return "webhook_pending";
  if (!input.subscriptionActive || !input.creditGrantRecorded) return "provisioning_pending";
  return "confirmed";
}
