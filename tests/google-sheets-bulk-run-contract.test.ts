import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(resolve(process.cwd(), "google-sheets-addon/Code.gs"), "utf8");

describe("Google Sheets detailed batch contract", () => {
  it("keeps the proven detailed batch API and 100-email selected-scan limit", () => {
    expect(script).toContain('var BATCH_ENDPOINT = "/api/v1/email/batch-check"');
    expect(script).toContain("var MAX_BATCH_SIZE = 100;");
    expect(script).toContain("processBatch_(sheet, selection, emails");
    expect(script).not.toContain("function startBulkRun_");
  });

  it("keeps the existing full export-column writeback and 100-email column batches", () => {
    expect(script).toContain("for (var b = 0; b < emails.length; b += MAX_BATCH_SIZE)");
    expect(script).toContain("processBatch_(sheet, range.offset(b, 0, batch.length, 1)");
    expect(script).toContain("writeResults_(sheet, anchorRange, result.results, result.export_columns || []");
    expect(script).toContain("sheet.getRange(rowToWrite, startCol + 1, 1, rowValues.length).setValues([rowValues])");
  });
});
