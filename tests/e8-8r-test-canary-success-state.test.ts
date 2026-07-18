import { describe, expect, it } from "vitest";
import { resolveTestCanarySuccessState } from "@/lib/test-canary-success-state";

describe("Test Canary billing success truth", () => {
  it("never treats an unverified redirect as payment success", () => {
    expect(resolveTestCanarySuccessState({
      redirectVerified: false,
      paymentStatus: "completed",
      subscriptionActive: true,
      creditGrantRecorded: true,
    })).toBe("redirect_unverified");
  });

  it("keeps a verified redirect pending until the webhook completes payment", () => {
    expect(resolveTestCanarySuccessState({ redirectVerified: true, paymentStatus: "pending" }))
      .toBe("webhook_pending");
  });

  it("requires both isolated subscription and evidence-only grant", () => {
    expect(resolveTestCanarySuccessState({
      redirectVerified: true,
      paymentStatus: "completed",
      subscriptionActive: true,
      creditGrantRecorded: false,
    })).toBe("provisioning_pending");
  });

  it("reports confirmed only after all isolated evidence exists", () => {
    expect(resolveTestCanarySuccessState({
      redirectVerified: true,
      paymentStatus: "completed",
      subscriptionActive: true,
      creditGrantRecorded: true,
    })).toBe("confirmed");
  });
});
