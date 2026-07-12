import { NextRequest, NextResponse } from "next/server";
import { resolveBulkRunActor } from "@/lib/bulk-runs/auth";
import { BulkRunServiceError, mapBulkRunDatabaseError } from "@/lib/bulk-runs/errors";
import { createSupabaseBulkRunRepository } from "@/lib/bulk-runs/repository";
import { processBulkRunChunk } from "@/lib/bulk-runs/processor";

export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string; chunkIndex: string }> }) {
  try {
    const actor = await resolveBulkRunActor(request); const { runId, chunkIndex: rawIndex } = await params; const chunkIndex = Number(rawIndex);
    if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0) throw new BulkRunServiceError("INVALID_CHUNK_INDEX", 400, "Invalid chunk index.");
    const repository = createSupabaseBulkRunRepository(); const claimed = await repository.claimChunk(actor.userId, runId, chunkIndex) as { status: string; contacts: string[]; claim_token: string | null } | null;
    if (!claimed) throw new BulkRunServiceError("CHUNK_NOT_FOUND", 404, "Bulk run chunk not found.");
    if (claimed.status === "completed") return NextResponse.json({ status: "completed", replayed: true });
    if (claimed.status !== "processing") return NextResponse.json({ status: claimed.status, replayed: true }, { status: 409 });
    if (!claimed.claim_token) throw new BulkRunServiceError("BULK_RUN_UNAVAILABLE", 500, "Bulk processing is temporarily unavailable.");
    try {
      const result = await processBulkRunChunk(claimed.contacts);
      await repository.finalizeChunk(actor.userId, runId, chunkIndex, claimed.claim_token, result);
      return NextResponse.json({ status: "completed", resultCount: result.results.length });
    } catch (processingError) {
      await repository.failChunk(actor.userId, runId, chunkIndex, claimed.claim_token, "Chunk processing failed.", true).catch(() => undefined);
      throw processingError;
    }
  } catch (error) { const safe = error instanceof BulkRunServiceError ? error : mapBulkRunDatabaseError(error); return NextResponse.json({ error: safe.code, message: safe.message }, { status: safe.status }); }
}
