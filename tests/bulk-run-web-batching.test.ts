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
    expect(page).toContain("readWebBulkFileEmails(file)");
    expect(batching).toContain('import * as XLSXLib from "xlsx"');
    expect(batching).toContain("XLSXLib.read(await file.arrayBuffer()");
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
