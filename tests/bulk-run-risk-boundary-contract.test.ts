import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const boundaryFiles = [
  "src/lib/risk-engine.ts",
  "src/lib/response.ts",
  "src/app/api/web-risk/route.ts",
  "src/app/api/v1/pre-send/check/route.ts",
  "src/app/(dashboard)/bulk-check/page.tsx",
  "src/app/(dashboard)/risk-check/page.tsx",
  "src/app/pre-send/page.tsx",
];

describe("locked Secwyn risk decision boundaries", () => {
  it("uses REVIEW at 26 and BLOCK at 66 on every decision surface", () => {
    const source = boundaryFiles.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(source).not.toMatch(/(?:riskScore|risk_score|score|local\.score)\s*>=\s*60/);
    expect(source).not.toMatch(/(?:riskScore|risk_score|score|local\.score)\s*>=\s*30/);
    expect(source).toMatch(/(?:riskScore|risk_score|score|local\.score)\s*>=\s*66/);
    expect(source).toMatch(/(?:riskScore|risk_score|score|local\.score)\s*>=\s*26/);
  });
});
