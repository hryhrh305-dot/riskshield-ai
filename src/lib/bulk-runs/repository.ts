import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BulkRunCreateInput, StoredBulkRun } from "./types";

export function getBulkRunAdmin(): SupabaseClient {
  return getSupabaseAdminClient();
}

export function createSupabaseBulkRunRepository(supabase = getBulkRunAdmin()) {
  return {
    async createRun(input: BulkRunCreateInput): Promise<StoredBulkRun> {
      const { data, error } = await supabase.rpc("create_bulk_run", {
        p_user_id: input.userId,
        p_source: input.source,
        p_chunks: input.chunks,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_policy_version: input.policyVersion,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("BULK_RUN_UNAVAILABLE");
      return row as StoredBulkRun;
    },
    async getRun(userId: string, runId: string) {
      const { data, error } = await supabase.from("bulk_runs").select("id,status,total_contacts,completed_contacts,failed_contacts,reserved_credits,released_credits,created_at,updated_at,expires_at,last_error").eq("id", runId).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    async getResults(userId: string, runId: string, offset: number, limit: number) {
      const { data, error } = await supabase.from("bulk_run_chunks").select("chunk_index,result_payload,status").eq("run_id", runId).eq("user_id", userId).eq("status", "completed").order("chunk_index", { ascending: true }).range(offset, offset + limit - 1);
      if (error) throw error;
      return data ?? [];
    },
    async claimChunk(userId: string, runId: string, chunkIndex: number) {
      const { data, error } = await supabase.rpc("claim_bulk_run_chunk", { p_user_id: userId, p_run_id: runId, p_chunk_index: chunkIndex, p_lease_seconds: 60 });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    async finalizeChunk(userId: string, runId: string, chunkIndex: number, claimToken: string, result: unknown) {
      const { data, error } = await supabase.rpc("finalize_bulk_run_chunk", { p_user_id: userId, p_run_id: runId, p_chunk_index: chunkIndex, p_claim_token: claimToken, p_result: result });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    async failChunk(userId: string, runId: string, chunkIndex: number, claimToken: string, errorMessage: string, retryable: boolean) {
      const { data, error } = await supabase.rpc("fail_bulk_run_chunk", { p_user_id: userId, p_run_id: runId, p_chunk_index: chunkIndex, p_claim_token: claimToken, p_error: errorMessage, p_retryable: retryable });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    async cancelRun(userId: string, runId: string) {
      const { data, error } = await supabase.rpc("release_bulk_run_unfinished", { p_user_id: userId, p_run_id: runId, p_reason: "Cancelled by user", p_terminal_status: "cancelled" });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
  };
}
