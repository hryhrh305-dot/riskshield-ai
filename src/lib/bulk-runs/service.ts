import { BULK_RUN_POLICY_VERSION, computeBulkRunFingerprint, normalizeBulkRunEmails, splitIntoBulkRunChunks } from "@/lib/bulk-run-policy";
import { BulkRunInputError } from "@/lib/bulk-run-policy";
import { BulkRunServiceError, mapBulkRunDatabaseError } from "./errors";
import type { BulkRunCreateInput, BulkRunSource, StoredBulkRun } from "./types";

export type CreateBulkRunRepository = {
  createRun(input: BulkRunCreateInput): Promise<StoredBulkRun>;
};

export type CreateOrReplayRequest = { userId: string; source: BulkRunSource; idempotencyKey: string; emails: string[]; processingVersion?: string };

function chunkFingerprint(contacts: string[]): string {
  return computeBulkRunFingerprint(contacts, "api", BULK_RUN_POLICY_VERSION, "chunk-v1");
}

export function createBulkRunService(repository: CreateBulkRunRepository) {
  return {
    async createOrReplayRun(request: CreateOrReplayRequest) {
      if (!/^[A-Za-z0-9._-]{16,200}$/.test(request.idempotencyKey)) {
        throw new BulkRunServiceError("INVALID_IDEMPOTENCY_KEY", 400, "A valid idempotency key is required.");
      }
      let contacts: string[];
      try {
        contacts = normalizeBulkRunEmails(request.emails);
      } catch (error) {
        if (error instanceof BulkRunInputError) throw new BulkRunServiceError(error.code, 400, error.message);
        throw error;
      }
      const processingVersion = request.processingVersion ?? "bulk-run-v1";
      const chunks = splitIntoBulkRunChunks(contacts).map((chunk, chunk_index) => ({
        chunk_index,
        contacts: chunk,
        input_fingerprint: chunkFingerprint(chunk),
      }));
      try {
        const run = await repository.createRun({
          userId: request.userId,
          source: request.source,
          idempotencyKey: request.idempotencyKey,
          requestFingerprint: computeBulkRunFingerprint(contacts, request.source, BULK_RUN_POLICY_VERSION, processingVersion),
          policyVersion: BULK_RUN_POLICY_VERSION,
          contacts,
          chunks,
        });
        return {
          runId: run.id,
          replayed: run.replayed,
          status: run.status,
          totalContacts: run.total_contacts,
          chunkCount: run.chunk_count,
          chunkSize: 50,
          requiredCredits: run.reserved_credits,
          createdAt: run.created_at,
          expiresAt: run.expires_at,
        };
      } catch (error) {
        if (error instanceof BulkRunServiceError) throw error;
        throw mapBulkRunDatabaseError(error);
      }
    },
  };
}
