import { describe, expect, it } from "vitest";
import {
  canReleaseBulkRunChunk,
  getPendingChunkIndexes,
  resolveChunkClaim,
  type BulkRunChunkSnapshot,
} from "@/lib/bulk-run-state";

const claimed: BulkRunChunkSnapshot = {
  chunkIndex: 0,
  status: "processing",
  idempotencyKey: "user:run:0",
  chargedCredits: 50,
  attemptCount: 1,
};

describe("bulk run idempotency state", () => {
  it("replays an existing key without charging it twice", () => {
    expect(resolveChunkClaim(claimed, "user:run:0")).toEqual({ action: "replay", chargeCredits: 0 });
  });

  it("does not allow a completed chunk to be released", () => {
    expect(canReleaseBulkRunChunk({ ...claimed, status: "completed" })).toBe(false);
  });

  it("allows a processing failed chunk to be released exactly once", () => {
    expect(canReleaseBulkRunChunk(claimed)).toBe(true);
    expect(canReleaseBulkRunChunk({ ...claimed, status: "cancelled" })).toBe(false);
  });

  it("resumes only pending or retryable chunks", () => {
    expect(getPendingChunkIndexes([
      { ...claimed, chunkIndex: 0, status: "completed" },
      { ...claimed, chunkIndex: 1, status: "failed_retryable" },
      { ...claimed, chunkIndex: 2, status: "pending" },
      { ...claimed, chunkIndex: 3, status: "cancelled" },
    ])).toEqual([1, 2]);
  });
});
