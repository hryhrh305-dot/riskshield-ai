import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chunkWebBulkEmails, mergeWebBulkResponses, runWebBulkBatches } from "@/lib/bulk-web-batching";

describe("web bulk batching", () => {
  it("wires both pasted and uploaded web scans through the batching helper", () => {
    const page = readFileSync("src/app/(dashboard)/bulk-check/page.tsx", "utf8");
    expect(page).toContain("runWebBulkBatches(chunks");
    expect(page).toContain("mergeWebBulkResponses(responses)");
    expect(page).toContain("XLSXLib.read(await file.arrayBuffer()");
    expect(page).not.toContain('fetch("/api/bulk-runs"');
  });

  it("deduplicates and splits 5,000 contacts into 100-contact requests", () => {
    const emails = Array.from({ length: 5000 }, (_, index) => `USER${index}@example.com`);
    const chunks = chunkWebBulkEmails([...emails, "user0@example.com"]);
    expect(chunks).toHaveLength(50);
    expect(chunks.every((chunk) => chunk.length === 100)).toBe(true);
    expect(chunks[0][0]).toBe("user0@example.com");
    expect(() => chunkWebBulkEmails([...emails, "extra@example.com"])).toThrow(/5,000/);
  });

  it("uses at most ten requests concurrently and preserves chunk order", async () => {
    let active = 0;
    let maximum = 0;
    const chunks = Array.from({ length: 12 }, (_, index) => [String(index)]);
    const responses = await runWebBulkBatches(chunks, async (chunk) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, chunk[0] === "0" ? 10 : 1));
      active -= 1;
      return { results: [{ email: chunk[0], risk_score: 1, risk_level: "ALLOW" }] };
    });
    expect(maximum).toBe(10);
    expect(responses.map((response) => response.results?.[0].email)).toEqual(chunks.flat());
  });

  it("merges every detailed result and keeps the server export columns", () => {
    const exportColumns = [{ key: "email", label: "Email" }, { key: "recommendation", label: "Recommendation" }];
    const merged = mergeWebBulkResponses([
      { export_columns: exportColumns, results: [{ email: "a@example.com", risk_score: 10, risk_level: "ALLOW", recommendation: "Send" }] },
      { export_columns: exportColumns, results: [{ email: "b@example.com", risk_score: 70, risk_level: "BLOCK", recommendation: "Suppress", risk_factors: ["No MX"] }] },
    ]);
    expect(merged.results).toHaveLength(2);
    expect(merged.results[1]).toMatchObject({ recommendation: "Suppress", risk_factors: ["No MX"] });
    expect(merged.export_columns).toEqual(exportColumns);
    expect(merged.summary).toMatchObject({ total: 2, clean: 1, risky: 0, blocked: 1 });
    expect(merged.audit_summary?.total).toBe(2);
  });
});
