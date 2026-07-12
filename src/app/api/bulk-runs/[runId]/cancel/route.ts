import { NextRequest, NextResponse } from "next/server";
import { resolveBulkRunActor } from "@/lib/bulk-runs/auth";
import { BulkRunServiceError, mapBulkRunDatabaseError } from "@/lib/bulk-runs/errors";
import { createSupabaseBulkRunRepository } from "@/lib/bulk-runs/repository";

export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try { const actor = await resolveBulkRunActor(request); const { runId } = await params; const run = await createSupabaseBulkRunRepository().cancelRun(actor.userId, runId) as { id: string; status: string; released_credits: number }; return NextResponse.json({ runId: run.id, status: run.status, releasedCredits: run.released_credits }); }
  catch (error) { const safe = error instanceof BulkRunServiceError ? error : mapBulkRunDatabaseError(error); return NextResponse.json({ error: safe.code, message: safe.message }, { status: safe.status }); }
}
