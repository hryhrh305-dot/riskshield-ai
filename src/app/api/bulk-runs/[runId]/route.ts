import { NextRequest, NextResponse } from "next/server";
import { resolveBulkRunActor } from "@/lib/bulk-runs/auth";
import { BulkRunServiceError, mapBulkRunDatabaseError } from "@/lib/bulk-runs/errors";
import { createSupabaseBulkRunRepository } from "@/lib/bulk-runs/repository";

export async function GET(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const actor = await resolveBulkRunActor(request); const { runId } = await params;
    const run = await createSupabaseBulkRunRepository().getRun(actor.userId, runId);
    if (!run) throw new BulkRunServiceError("BULK_RUN_NOT_FOUND", 404, "Bulk run not found.");
    return NextResponse.json({ runId: run.id, status: run.status, totalContacts: run.total_contacts, completed: run.completed_contacts, failed: run.failed_contacts, pending: run.total_contacts - run.completed_contacts - run.failed_contacts, reservedCredits: run.reserved_credits, releasedCredits: run.released_credits, createdAt: run.created_at, updatedAt: run.updated_at, expiresAt: run.expires_at, lastError: run.last_error, recoverable: ["pending", "processing", "partial"].includes(run.status) });
  } catch (error) { const safe = error instanceof BulkRunServiceError ? error : mapBulkRunDatabaseError(error); return NextResponse.json({ error: safe.code, message: safe.message }, { status: safe.status }); }
}
