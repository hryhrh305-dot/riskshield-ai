import { getUniqueBillableEmails } from "@/lib/legacy-credits";
import { createHash } from "node:crypto";

export const BULK_RUN_POLICY_VERSION = 1;
export const MAX_CONTACTS_PER_USER_RUN = 5000;
export const INTERNAL_CHUNK_SIZE = 50;
export const MAX_PARALLEL_CHUNKS = 2;
export const MAX_CHUNK_RETRIES = 1;
export const RETRY_BACKOFF_MS = 2000;
export const CLIENT_PROGRESS_POLL_INTERVAL_MS = 1500;
export const APPS_SCRIPT_EXECUTION_BUDGET_MS = 270000;

export class BulkRunInputError extends Error {
  readonly code: "TOO_MANY_CONTACTS" | "NO_VALID_CONTACTS";

  constructor(code: "TOO_MANY_CONTACTS" | "NO_VALID_CONTACTS", message: string) {
    super(message);
    this.name = "BulkRunInputError";
    this.code = code;
  }
}

export function normalizeBulkRunEmails(input: string[]): string[] {
  const emails = getUniqueBillableEmails(input);

  if (emails.length === 0) {
    throw new BulkRunInputError("NO_VALID_CONTACTS", "No valid email addresses were found.");
  }

  if (emails.length > MAX_CONTACTS_PER_USER_RUN) {
    throw new BulkRunInputError(
      "TOO_MANY_CONTACTS",
      `Too many contacts. Maximum is ${MAX_CONTACTS_PER_USER_RUN} unique contacts per run.`,
    );
  }

  return emails;
}

export function splitIntoBulkRunChunks<T>(items: T[], chunkSize = INTERNAL_CHUNK_SIZE): T[][] {
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0 || chunkSize > INTERNAL_CHUNK_SIZE) {
    throw new Error(`Chunk size must be between 1 and ${INTERNAL_CHUNK_SIZE}.`);
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export function computeBulkRunFingerprint(
  input: string[],
  source: "web" | "sheets" | "api",
  policyVersion: number,
  processingVersion: string,
): string {
  const emails = getUniqueBillableEmails(input).sort();
  const canonical = JSON.stringify({ source, policyVersion, processingVersion, emails });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
