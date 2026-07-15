import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const script = readFileSync(resolve(process.cwd(), "google-sheets-addon/Code.gs"), "utf8");

describe("Google Sheets detailed batch contract", () => {
  it("keeps the proven detailed batch API while allowing 5,000 selected emails", () => {
    expect(script).toContain('var BATCH_ENDPOINT = "/api/v1/email/batch-check"');
    expect(script).toContain("var MAX_BATCH_SIZE = 100;");
    expect(script).toContain("var MAX_CONTACTS_PER_SCAN = 5000;");
    expect(script).toContain("var MAX_PARALLEL_BATCHES = 20;");
    expect(script).toContain("processBatches_(sheet, selection, emails");
    expect(script).toContain("UrlFetchApp.fetchAll(requests)");
    expect(script).not.toContain("function startBulkRun_");
  });

  it("keeps the existing full export-column writeback and 100-email column batches", () => {
    expect(script).toContain("processBatches_(sheet, range, emails");
    expect(script).toContain("Maximum " + '" + MAX_CONTACTS_PER_SCAN + "' + " emails per scan");
    expect(script).toContain("writeResults_(sheet, anchorRange, result.results, result.export_columns || []");
    expect(script).toContain("sheet.getRange(rowToWrite, startCol + 1, 1, rowValues.length).setValues([rowValues])");
    expect(script).toContain('if (result.catch_all_status === "not_tested") return "Not tested"');
    expect(script).toContain('if (result.mx_status === "lookup_failed") return "Lookup failed"');
    expect(script).toContain("Duplicates removed: ");
  });

  it("retries one transient DNS failure without changing the request batch", () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const context = {
      UrlFetchApp: {
        fetchAll(requests: unknown[]) {
          attempts += 1;
          if (attempts === 1) throw new Error("DNS error: https://www.secwyn.com");
          return requests;
        },
      },
      Utilities: { sleep(milliseconds: number) { sleeps.push(milliseconds); } },
    };

    runInNewContext(script, context);
    const requests = [{ url: "https://www.secwyn.com/api/v1/email/batch-check" }];
    const responses = (context as typeof context & {
      fetchAllWithRetry_: (value: unknown[]) => unknown[];
    }).fetchAllWithRetry_(requests);

    expect(responses).toEqual(requests);
    expect(attempts).toBe(2);
    expect(sleeps).toEqual([1000]);
  });
});
