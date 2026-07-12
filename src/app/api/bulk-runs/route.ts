import { NextRequest, NextResponse } from "next/server";
import { resolveBulkRunActor } from "@/lib/bulk-runs/auth";
import { BulkRunServiceError } from "@/lib/bulk-runs/errors";
import { createSupabaseBulkRunRepository } from "@/lib/bulk-runs/repository";
import { createBulkRunService } from "@/lib/bulk-runs/service";

function errorResponse(error: unknown) {
  const safe = error instanceof BulkRunServiceError ? error : new BulkRunServiceError("BULK_RUN_UNAVAILABLE", 500, "Bulk processing is temporarily unavailable.");
  return NextResponse.json({ error: safe.code, message: safe.message, details: safe.details }, { status: safe.status });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveBulkRunActor(request);
    const body = await request.json();
    if (!Array.isArray(body.emails)) throw new BulkRunServiceError("INVALID_INPUT", 400, "Emails must be an array.");
    const idempotencyKey = request.headers.get("idempotency-key") || body.idempotencyKey;
    const service = createBulkRunService(createSupabaseBulkRunRepository());
    const run = await service.createOrReplayRun({ userId: actor.userId, source: actor.source, idempotencyKey, emails: body.emails });
    return NextResponse.json(run, { status: run.replayed ? 200 : 201 });
  } catch (error) { return errorResponse(error); }
}
