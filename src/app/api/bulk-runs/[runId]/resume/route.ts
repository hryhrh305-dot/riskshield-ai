import { NextRequest, NextResponse } from "next/server";
import { resolveBulkRunActor } from "@/lib/bulk-runs/auth";
import { BulkRunServiceError, mapBulkRunDatabaseError } from "@/lib/bulk-runs/errors";
import { getBulkRunAdmin } from "@/lib/bulk-runs/repository";

export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const actor = await resolveBulkRunActor(request); const { runId } = await params; const admin = getBulkRunAdmin();
    const { data: run, error: runError } = await admin.from("bulk_runs").select("status,expires_at").eq("id", runId).eq("user_id", actor.userId).maybeSingle();
    if (runError) throw runError; if (!run) throw new BulkRunServiceError("BULK_RUN_NOT_FOUND", 404, "Bulk run not found.");
    if (new Date(run.expires_at).getTime() <= Date.now()) throw new BulkRunServiceError("RUN_EXPIRED", 409, "This bulk run has expired.");
    if (["completed", "cancelled", "expired", "failed_terminal"].includes(run.status)) throw new BulkRunServiceError("RUN_NOT_RESUMABLE", 409, "This bulk run cannot be resumed.");
    const now = new Date().toISOString();
    const { data: chunks, error } = await admin.from("bulk_run_chunks").select("chunk_index").eq("run_id", runId).eq("user_id", actor.userId).or(`status.in.(pending,failed_retryable),and(status.eq.processing,lease_expires_at.lt.${now})`).order("chunk_index");
    if (error) throw error;
    return NextResponse.json({ runId, chunkIndexes: (chunks ?? []).map((chunk: { chunk_index: number }) => chunk.chunk_index) });
  } catch (error) { const safe = error instanceof BulkRunServiceError ? error : mapBulkRunDatabaseError(error); return NextResponse.json({ error: safe.code, message: safe.message }, { status: safe.status }); }
}
