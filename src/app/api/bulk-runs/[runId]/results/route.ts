import { NextRequest, NextResponse } from "next/server";
import { resolveBulkRunActor } from "@/lib/bulk-runs/auth";
import { BulkRunServiceError, mapBulkRunDatabaseError } from "@/lib/bulk-runs/errors";
import { createSupabaseBulkRunRepository } from "@/lib/bulk-runs/repository";

export async function GET(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const actor = await resolveBulkRunActor(request); const { runId } = await params;
    const cursor = Math.max(0, Number(request.nextUrl.searchParams.get("cursor") || 0) || 0);
    const limit = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 20) || 20));
    const repository = createSupabaseBulkRunRepository(); const run = await repository.getRun(actor.userId, runId);
    if (!run) throw new BulkRunServiceError("BULK_RUN_NOT_FOUND", 404, "Bulk run not found.");
    const chunks = await repository.getResults(actor.userId, runId, cursor, limit);
    return NextResponse.json({ results: chunks.flatMap((chunk: { result_payload?: { results?: unknown[] } | null }) => Array.isArray(chunk.result_payload?.results) ? chunk.result_payload.results : []), nextCursor: chunks.length === limit ? cursor + limit : null });
  } catch (error) { const safe = error instanceof BulkRunServiceError ? error : mapBulkRunDatabaseError(error); return NextResponse.json({ error: safe.code, message: safe.message }, { status: safe.status }); }
}
