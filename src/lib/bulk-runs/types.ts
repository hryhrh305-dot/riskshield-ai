export const BULK_RUN_STATUSES = ["pending", "processing", "partial", "completed", "cancelled", "expired", "failed_terminal"] as const;
export const BULK_RUN_CHUNK_STATUSES = ["pending", "processing", "completed", "failed_retryable", "failed_terminal", "cancelled", "expired"] as const;

export type BulkRunStatus = (typeof BULK_RUN_STATUSES)[number];
export type BulkRunChunkStatus = (typeof BULK_RUN_CHUNK_STATUSES)[number];
export type BulkRunSource = "web" | "sheets" | "api";

export type BulkRunChunkInput = {
  chunk_index: number;
  contacts: string[];
  input_fingerprint: string;
};

export type StoredBulkRun = {
  id: string;
  replayed: boolean;
  status: BulkRunStatus;
  total_contacts: number;
  chunk_count: number;
  reserved_credits: number;
  created_at: string;
  expires_at: string;
};

export type BulkRunCreateInput = {
  userId: string;
  source: BulkRunSource;
  idempotencyKey: string;
  requestFingerprint: string;
  policyVersion: number;
  contacts: string[];
  chunks: BulkRunChunkInput[];
};
