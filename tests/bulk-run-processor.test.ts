import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/risk-engine", () => ({
  calculateRiskScore: vi.fn(async () => ({
    score: 66,
    decision: "BLOCK",
    reasons: ["Disposable address"],
    emailDetails: { isDisposable: true },
    risk_factors: ["Disposable email detected"],
    recommendation: "Do not send.",
    estimated_waste_cost: 12.5,
  })),
}));

import { processBulkRunChunk } from "@/lib/bulk-runs/processor";

describe("bulk run processor", () => {
  it("preserves the legacy Sheets result fields for resumable runs", async () => {
    const { results } = await processBulkRunChunk(["qa@example.invalid"]);

    expect(results[0]).toMatchObject({
      email: "qa@example.invalid",
      risk_score: 66,
      risk_level: "BLOCK",
      risk_factors: ["Disposable email detected"],
      recommendation: "Do not send.",
      estimated_waste_cost: 12.5,
    });
  });
});
