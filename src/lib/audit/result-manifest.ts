export type ResultFormatMode =
  | "canonical"
  | "web"
  | "html_full"
  | "pdf_summary"
  | "csv_full"
  | "xlsx_full"
  | "queue_export";

export type ResultManifest = {
  inputRows: number;
  syntaxAccepted: number;
  rejectedRows: number;
  duplicateOccurrences: number;
  uniqueProcessed: number;
  resultCount: number;
  creditsConsumed: number;
  sendCount: number;
  reviewCount: number;
  suppressCount: number;
  totalDetailRecords: number;
  includedDetailRecords: number;
  formatMode: ResultFormatMode;
  isFullResultSet: boolean;
};

function count(value: number): number {
  return Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0));
}

export function buildResultManifest(input: Omit<ResultManifest, "isFullResultSet">): ResultManifest {
  const manifest = {
    ...input,
    inputRows: count(input.inputRows),
    syntaxAccepted: count(input.syntaxAccepted),
    rejectedRows: count(input.rejectedRows),
    duplicateOccurrences: count(input.duplicateOccurrences),
    uniqueProcessed: count(input.uniqueProcessed),
    resultCount: count(input.resultCount),
    creditsConsumed: count(input.creditsConsumed),
    sendCount: count(input.sendCount),
    reviewCount: count(input.reviewCount),
    suppressCount: count(input.suppressCount),
    totalDetailRecords: count(input.totalDetailRecords),
    includedDetailRecords: count(input.includedDetailRecords),
  };

  return {
    ...manifest,
    isFullResultSet: manifest.includedDetailRecords === manifest.totalDetailRecords,
  };
}

export function scopeResultManifest(
  manifest: ResultManifest,
  formatMode: ResultFormatMode,
  includedDetailRecords: number,
): ResultManifest {
  return buildResultManifest({
    ...manifest,
    formatMode,
    includedDetailRecords,
  });
}

export function getResultManifestInvariantErrors(manifest: ResultManifest): string[] {
  const errors: string[] = [];
  if (manifest.syntaxAccepted - manifest.duplicateOccurrences !== manifest.uniqueProcessed) {
    errors.push("syntaxAccepted - duplicateOccurrences must equal uniqueProcessed");
  }
  if (manifest.uniqueProcessed !== manifest.resultCount) {
    errors.push("uniqueProcessed must equal resultCount");
  }
  if (manifest.resultCount !== manifest.creditsConsumed) {
    errors.push("resultCount must equal creditsConsumed");
  }
  if (manifest.sendCount + manifest.reviewCount + manifest.suppressCount !== manifest.resultCount) {
    errors.push("sendCount + reviewCount + suppressCount must equal resultCount");
  }
  return errors;
}

export function formatVisibleResultRange(included: number, total: number, overallTotal = total): string {
  const safeIncluded = count(included);
  const safeTotal = count(total);
  const safeOverallTotal = count(overallTotal);
  const start = safeIncluded > 0 ? 1 : 0;
  const filtered = safeOverallTotal !== safeTotal;
  return `Showing ${start.toLocaleString("en-US")}–${safeIncluded.toLocaleString("en-US")} of ${safeTotal.toLocaleString("en-US")} ${filtered ? "matching " : ""}unique results${filtered ? ` · ${safeOverallTotal.toLocaleString("en-US")} total unique results` : ""}.`;
}
