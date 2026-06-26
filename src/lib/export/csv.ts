export type CsvColumn<T extends Record<string, unknown>> = {
  key: string;
  label: string;
  format?: (row: T) => unknown;
};

function stringifyCsvValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map(stringifyCsvValue).filter(Boolean).join("; ");
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

function escapeCsvCell(value: unknown): string {
  const text = stringifyCsvValue(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export function buildCsvContent<T extends Record<string, unknown>>(rows: T[], columns: Array<CsvColumn<T>>): string {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => {
    const rawValue = column.format ? column.format(row) : row[column.key];
    return escapeCsvCell(rawValue);
  }).join(","));
  return [header, ...body].join("\n");
}

export function downloadCsvFile(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
