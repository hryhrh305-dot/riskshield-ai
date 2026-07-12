import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "@/lib/bulk-runs/client";

describe("bulk run client", () => {
  it("runs no more than two chunks concurrently", async () => {
    let active = 0; let maximum = 0;
    await runWithConcurrency([0, 1, 2, 3, 4], 2, async () => { active += 1; maximum = Math.max(maximum, active); await Promise.resolve(); active -= 1; });
    expect(maximum).toBe(2);
  });

  it("retries a temporary error once but does not retry a 4xx", async () => {
    let temporaryAttempts = 0; let clientAttempts = 0;
    await runWithConcurrency([0], 2, async () => { temporaryAttempts += 1; if (temporaryAttempts === 1) throw { status: 500 }; });
    await expect(runWithConcurrency([0], 2, async () => { clientAttempts += 1; throw { status: 400 }; })).rejects.toEqual({ status: 400 });
    expect(temporaryAttempts).toBe(2); expect(clientAttempts).toBe(1);
  });
});
