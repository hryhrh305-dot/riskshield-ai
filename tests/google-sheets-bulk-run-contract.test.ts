import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(resolve(process.cwd(), "google-sheets-addon/Code.gs"), "utf8");

describe("Google Sheets bulk run contract", () => {
  it("uses the protected bulk-run API with a 5,000 unique-contact limit", () => {
    expect(script).toContain('var BULK_RUN_ENDPOINT = "/api/bulk-runs"');
    expect(script).toContain("var MAX_CONTACTS_PER_RUN = 5000");
    expect(script).toContain('headers: { "x-api-key": apiKey, "Idempotency-Key"');
  });

  it("persists continuation state and uses a time-based trigger", () => {
    expect(script).toContain("PropertiesService.getUserProperties().setProperty(BULK_STATE_KEY");
    expect(script).toContain('ScriptApp.newTrigger("continueBulkRun_").timeBased()');
    expect(script).toContain("triggerId");
  });

  it("writes bulk results with setValues and does not mark partial work complete", () => {
    expect(script).toContain(".setValues(output)");
    expect(script).toContain('outcome === "completed"');
    expect(script).toContain("bulk run is partially complete");
    expect(script).toContain('{ key: "risk_factors", label: "Risk Factors" }');
    expect(script).toContain('var headerRow = range.getRow() > 1 ? range.getRow() - 1 : range.getRow();');
  });
});
