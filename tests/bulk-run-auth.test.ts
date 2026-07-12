import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("bulk run API plan eligibility", () => {
  it("uses the shared Growth-or-higher plan gate for API-key actors", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/bulk-runs/auth.ts"), "utf8");
    expect(source).toContain('isPlanAtLeast(String(profile.plan), "growth")');
  });
});
