import type { BulkRunChunkStatus } from "./bulk-runs/types";

export type BulkRunChunkSnapshot = {
  chunkIndex: number;
  status: BulkRunChunkStatus;
  idempotencyKey: string;
  chargedCredits: number;
  attemptCount: number;
};

export function resolveChunkClaim(existing: BulkRunChunkSnapshot | null, idempotencyKey: string) {
  if (existing && existing.idempotencyKey === idempotencyKey) return { action: "replay" as const, chargeCredits: 0 };
  return { action: "claim" as const, chargeCredits: 0 };
}

export function canReleaseBulkRunChunk(chunk: BulkRunChunkSnapshot): boolean {
  return chunk.status === "pending" || chunk.status === "processing" || chunk.status === "failed_retryable" || chunk.status === "failed_terminal";
}

export function getPendingChunkIndexes(chunks: BulkRunChunkSnapshot[]): number[] {
  return chunks
    .filter((chunk) => chunk.status === "pending" || chunk.status === "failed_retryable")
    .map((chunk) => chunk.chunkIndex)
    .sort((left, right) => left - right);
}
