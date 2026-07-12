export class BulkRunServiceError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BulkRunServiceError";
  }
}

const DATABASE_ERROR_MAP: Array<[string, string, number, string]> = [
  ["IDEMPOTENCY_KEY_CONFLICT", "IDEMPOTENCY_KEY_CONFLICT", 409, "This idempotency key was already used for different input."],
  ["ACTIVE_DUPLICATE_RUN", "ACTIVE_DUPLICATE_RUN", 409, "An active run already exists for these contacts."],
  ["INSUFFICIENT_CREDITS", "INSUFFICIENT_CREDITS", 429, "Insufficient credits for this bulk run."],
  ["BULK_RUN_NOT_FOUND", "BULK_RUN_NOT_FOUND", 404, "Bulk run not found."],
  ["BULK_RUN_EXPIRED", "RUN_EXPIRED", 409, "This bulk run has expired."],
  ["BULK_RUN_CANCELLED", "RUN_CANCELLED", 409, "This bulk run was cancelled."],
  ["BULK_RUN_COMPLETED", "RUN_ALREADY_COMPLETED", 409, "This bulk run is already completed."],
  ["BULK_RUN_CHUNK_NOT_FOUND", "CHUNK_NOT_FOUND", 404, "Bulk run chunk not found."],
  ["BULK_RUN_STALE_CLAIM", "STALE_CHUNK_CLAIM", 409, "This chunk lease has expired or was superseded."],
];

export function mapBulkRunDatabaseError(error: unknown): BulkRunServiceError {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");
  for (const [needle, code, status, safeMessage] of DATABASE_ERROR_MAP) {
    if (message.includes(needle)) return new BulkRunServiceError(code, status, safeMessage);
  }
  return new BulkRunServiceError("BULK_RUN_UNAVAILABLE", 500, "Bulk processing is temporarily unavailable.");
}
