import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSXLib from "xlsx";
import * as webBulk from "@/lib/bulk-web-batching";

const { chunkWebBulkEmails, mergeWebBulkResponses, runWebBulkBatches } = webBulk;

type DroppedFile = {
  name: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type DropResolver = (dataTransfer: {
  items?: ArrayLike<{ kind: string; getAsFile(): DroppedFile | null }>;
  files?: ArrayLike<DroppedFile>;
}) => DroppedFile | null;

type FileReader = (file: DroppedFile) => Promise<string[]>;

describe("web bulk batching", () => {
  it("wires both pasted and uploaded web scans through the batching helper", () => {
    const page = readFileSync("src/app/(dashboard)/bulk-check/page.tsx", "utf8");
    const batching = readFileSync("src/lib/bulk-web-batching.ts", "utf8");
    expect(page).toContain("runWebBulkBatches(chunks");
    expect(page).toContain("mergeWebBulkResponses(responses)");
    expect(page).toContain("readWebBulkFileInput(file)");
    expect(page).toContain("reconcileWebBulkText(text)");
    expect(batching).toContain('import * as XLSXLib from "xlsx"');
    expect(batching).toContain("XLSXLib.read(await file.arrayBuffer()");
    expect(page).not.toContain('fetch("/api/bulk-runs"');
  });

  it("rejects internal-space mutation and reconciles duplicates", () => {
    const reconciliation = webBulk.reconcileWebBulkText([
      "space inlocal@example.com",
      "FIRST@example.com",
      "first@example.com",
    ].join("\n"));

    expect(reconciliation.accepted).toEqual(["first@example.com"]);
    expect(reconciliation.rejectedBeforeScreening).toBe(1);
    expect(reconciliation.duplicatesRemoved).toBe(1);
    expect(reconciliation.rows[0]).toMatchObject({ originalValue: "space inlocal@example.com", status: "REJECT_BEFORE_SCREENING" });
  });

  it("deduplicates and splits 5,000 contacts into shorter 50-contact requests", () => {
    const emails = Array.from({ length: 5000 }, (_, index) => `USER${index}@example.com`);
    const chunks = chunkWebBulkEmails([...emails, "user0@example.com"]);
    expect(chunks).toHaveLength(100);
    expect(chunks.every((chunk) => chunk.length === 50)).toBe(true);
    expect(chunks[0][0]).toBe("user0@example.com");
    expect(() => chunkWebBulkEmails([...emails, "extra@example.com"])).toThrow(/5,000/);
  });

  it("resolves dragged files from DataTransfer items with a files fallback", () => {
    const resolveDroppedFile = (webBulk as unknown as { getDroppedWebBulkFile?: DropResolver }).getDroppedWebBulkFile;
    expect(resolveDroppedFile).toBeTypeOf("function");
    if (!resolveDroppedFile) return;

    const itemFile = { name: "contacts.csv" } as DroppedFile;
    const fallbackFile = { name: "contacts.txt" } as DroppedFile;
    expect(resolveDroppedFile({
      items: [{ kind: "string", getAsFile: () => null }, { kind: "file", getAsFile: () => itemFile }],
      files: [fallbackFile],
    })).toBe(itemFile);
    expect(resolveDroppedFile({ items: [], files: [fallbackFile] })).toBe(fallbackFile);
  });

  it("reads CSV and TXT uploads into normalized unique emails", async () => {
    const readFileEmails = (webBulk as unknown as { readWebBulkFileEmails?: FileReader }).readWebBulkFileEmails;
    expect(readFileEmails).toBeTypeOf("function");
    if (!readFileEmails) return;

    const emptyBuffer = async () => new ArrayBuffer(0);
    const csv = await readFileEmails({
      name: "contacts.csv",
      text: async () => '\uFEFFemail,name\n"FIRST@Example.com",First\nsecond@example.com,Second\nfirst@example.com,Duplicate',
      arrayBuffer: emptyBuffer,
    });
    const txt = await readFileEmails({
      name: "contacts.txt",
      text: async () => "FIRST@example.com\nsecond@example.com\nfirst@example.com",
      arrayBuffer: emptyBuffer,
    });
    expect(csv).toEqual(["first@example.com", "second@example.com"]);
    expect(txt).toEqual(["first@example.com", "second@example.com"]);
  });

  it("reads XLSX uploads and enforces the shared 5,000-contact limit", async () => {
    const readFileEmails = (webBulk as unknown as { readWebBulkFileEmails?: FileReader }).readWebBulkFileEmails;
    expect(readFileEmails).toBeTypeOf("function");
    if (!readFileEmails) return;

    const workbook = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(workbook, XLSXLib.utils.aoa_to_sheet([
      ["Email", "Owner"],
      ["first@example.com", "First"],
      ["SECOND@example.com", "Second"],
    ]), "Contacts");
    const bytes = XLSXLib.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    expect(await readFileEmails({ name: "contacts.xlsx", text: async () => "", arrayBuffer: async () => bytes }))
      .toEqual(["first@example.com", "second@example.com"]);

    const tooMany = Array.from({ length: 5001 }, (_, index) => `user${index}@example.com`).join("\n");
    await expect(readFileEmails({ name: "too-many.txt", text: async () => tooMany, arrayBuffer: async () => new ArrayBuffer(0) }))
      .rejects.toThrow(/5,000/);
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

  it("retries transient batch failures without retrying deterministic failures", async () => {
    let attempts = 0;
    const retries: string[] = [];
    const responses = await runWebBulkBatches(
      [["first@example.com"]],
      async () => {
        attempts += 1;
        if (attempts < 3) throw new TypeError("Failed to fetch");
        return { results: [{ email: "first@example.com", risk_score: 1, risk_level: "ALLOW" }] };
      },
      undefined,
      {
        maxAttempts: 3,
        baseDelayMs: 0,
        onRetry: (chunkIndex, nextAttempt, maxAttempts) => {
          retries.push(`${chunkIndex}:${nextAttempt}:${maxAttempts}`);
        },
      },
    );

    expect(attempts).toBe(3);
    expect(retries).toEqual(["0:2:3", "0:3:3"]);
    expect(responses[0].results?.[0].email).toBe("first@example.com");

    let deterministicAttempts = 0;
    await expect(runWebBulkBatches(
      [["second@example.com"]],
      async () => {
        deterministicAttempts += 1;
        throw Object.assign(new Error("Insufficient credits"), { retryable: false });
      },
      undefined,
      { maxAttempts: 3, baseDelayMs: 0 },
    )).rejects.toThrow("Insufficient credits");
    expect(deterministicAttempts).toBe(1);
  });

  it("uses one upload path and a stable idempotency key for every retryable chunk", () => {
    const page = readFileSync("src/app/(dashboard)/bulk-check/page.tsx", "utf8");
    expect(page).toContain('"idempotency-key": `bulk:${e8RunId}:${index}`');
    expect(page).toContain("onDrop={handleDrop}");
    expect(page).toMatch(/onChange=\{\([^)]*\).*handleFile\(file\)/s);
  });

  it("merges every detailed result and keeps the server export columns", () => {
    const exportColumns = [{ key: "email", label: "Email" }, { key: "recommendation", label: "Recommendation" }];
    const merged = mergeWebBulkResponses([
      { export_columns: exportColumns, results: [{ email: "a@secwyn.com", risk_score: 10, risk_level: "ALLOW", recommendation: "Send", details: { smtpChecked: true, smtpValid: true, hasMX: true, mxChecked: true, mxStatus: "present" } }] },
      { export_columns: exportColumns, results: [{ email: "b@company.invalid", risk_score: 70, risk_level: "BLOCK", recommendation: "Suppress", risk_factors: ["No MX"] }] },
    ]);
    expect(merged.results).toHaveLength(2);
    expect(merged.results[1]).toMatchObject({ recommendation: "Suppress", risk_factors: ["No MX"] });
    expect(merged.export_columns).toEqual(exportColumns);
    expect(merged.summary).toMatchObject({ total: 2, clean: 1, risky: 0, blocked: 1 });
    expect(merged.audit_summary?.total).toBe(2);
    expect(merged.audit_summary?.sendCount + merged.audit_summary.reviewCount + merged.audit_summary.suppressCount).toBe(2);
    expect(merged.summary.clean).toBe(merged.audit_summary.sendCount);
    expect(merged.summary.risky).toBe(merged.audit_summary.reviewCount);
    expect(merged.summary.blocked).toBe(merged.audit_summary.suppressCount);
  });
});
