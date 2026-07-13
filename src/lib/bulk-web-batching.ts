import { buildContactAuditDecision, buildListAuditSummary, type ListAuditSummary } from "@/lib/list-audit";
import * as XLSXLib from "xlsx";

export const WEB_BULK_BATCH_SIZE = 100;
export const WEB_BULK_MAX_CONTACTS = 5000;
export const WEB_BULK_CONCURRENCY = 10;

export type WebBulkResult = Record<string, unknown> & {
  email: string;
  risk_score: number;
  risk_level?: string;
  decision?: string;
};

export type WebBulkResponse = {
  results?: WebBulkResult[];
  export_columns?: Array<{ key: string; label: string }>;
  summary?: Record<string, number>;
  audit_summary?: ListAuditSummary;
};

const EMAIL_PATTERN = /^(?!.*\.\.)(?!\.)[^\s@]+(?<!\.)@(?!\.)[^\s@]+\.[^\s@]{2,}$/i;
const WEB_BULK_FILE_EXTENSIONS = [".csv", ".txt", ".xlsx", ".xls"];

export type WebBulkFile = {
  name: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type WebBulkDataTransfer = {
  items?: ArrayLike<{ kind: string; getAsFile(): WebBulkFile | null }>;
  files?: ArrayLike<WebBulkFile>;
};

export function extractWebBulkEmails(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((email) => email.trim().replace(/^[\uFEFF'"<({\[]+|['">)}\]]+$/g, "").toLowerCase())
    .filter((email) => EMAIL_PATTERN.test(email));
}

export function getDroppedWebBulkFile(dataTransfer: WebBulkDataTransfer): WebBulkFile | null {
  for (const item of Array.from(dataTransfer.items || [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return dataTransfer.files?.[0] || null;
}

export async function readWebBulkFileEmails(file: WebBulkFile): Promise<string[]> {
  const lowerName = file.name.toLowerCase();
  const extension = lowerName.includes(".") ? lowerName.slice(lowerName.lastIndexOf(".")) : "";
  if (!WEB_BULK_FILE_EXTENSIONS.includes(extension)) {
    throw new Error("Unsupported file type. Please upload a .csv, .txt, .xlsx, or .xls file.");
  }

  let sourceText: string;
  if (extension === ".xlsx" || extension === ".xls") {
    const workbook = XLSXLib.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("The spreadsheet does not contain a readable worksheet.");
    const rows = XLSXLib.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    sourceText = rows.flat().map(String).join("\n");
  } else {
    sourceText = await file.text();
  }

  return chunkWebBulkEmails(extractWebBulkEmails(sourceText)).flat();
}

export function chunkWebBulkEmails(input: string[]): string[][] {
  const emails = [...new Set(input.map((email) => email.trim().toLowerCase()).filter((email) => EMAIL_PATTERN.test(email)))];
  if (emails.length > WEB_BULK_MAX_CONTACTS) throw new Error("Maximum 5,000 unique emails per scan.");
  if (emails.length === 0) throw new Error("No valid emails found.");
  const chunks: string[][] = [];
  for (let index = 0; index < emails.length; index += WEB_BULK_BATCH_SIZE) chunks.push(emails.slice(index, index + WEB_BULK_BATCH_SIZE));
  return chunks;
}

export async function runWebBulkBatches<T>(
  chunks: string[][],
  request: (chunk: string[], index: number) => Promise<T>,
  onProgress?: (completed: number, total: number) => void,
): Promise<T[]> {
  const responses = new Array<T>(chunks.length);
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < chunks.length) {
      const index = cursor++;
      responses[index] = await request(chunks[index], index);
      completed += 1;
      onProgress?.(completed, chunks.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(WEB_BULK_CONCURRENCY, chunks.length) }, worker));
  return responses;
}

export function mergeWebBulkResponses(responses: WebBulkResponse[]): Required<Pick<WebBulkResponse, "results" | "export_columns" | "summary">> & { audit_summary: ListAuditSummary } {
  const results = responses.flatMap((response) => response.results || []);
  const exportColumns = responses.find((response) => response.export_columns?.length)?.export_columns || [];
  let clean = 0;
  let risky = 0;
  let blocked = 0;
  for (const result of results) {
    const decision = String(result.risk_level || result.decision || "").toUpperCase();
    if (decision === "ALLOW") clean += 1;
    else if (decision === "REVIEW") risky += 1;
    else blocked += 1;
  }
  const total = results.length;
  return {
    results,
    export_columns: exportColumns,
    summary: {
      total,
      clean,
      risky,
      blocked,
      clean_pct: total ? Math.round((clean / total) * 100) : 0,
      risky_pct: total ? Math.round((risky / total) * 100) : 0,
      blocked_pct: total ? Math.round((blocked / total) * 100) : 0,
      estimated_waste_pct: total ? Math.round((blocked / total) * 100) : 0,
    },
    audit_summary: buildListAuditSummary(results.map((result) => buildContactAuditDecision(result))),
  };
}
