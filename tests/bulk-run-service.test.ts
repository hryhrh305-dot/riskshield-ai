import { describe, expect, it } from "vitest";
import { BulkRunServiceError, mapBulkRunDatabaseError } from "@/lib/bulk-runs/errors";
import { createBulkRunService } from "@/lib/bulk-runs/service";

describe("bulk run service", () => {
  it("replays the same idempotency key without reserving credits again", async () => {
    let creates = 0;
    const service = createBulkRunService({
      createRun: async () => {
        creates += 1;
        return { id: "run-1", replayed: creates > 1, status: "pending", total_contacts: 1, chunk_count: 1, reserved_credits: 1, created_at: "2026-07-12T00:00:00Z", expires_at: "2026-07-19T00:00:00Z" };
      },
    });

    const request = { userId: "user-1", source: "web" as const, idempotencyKey: "1234567890123456", emails: ["ONE@example.com"] };
    const first = await service.createOrReplayRun(request);
    const replay = await service.createOrReplayRun(request);

    expect(first.runId).toBe("run-1");
    expect(replay.replayed).toBe(true);
    expect(creates).toBe(2);
  });

  it("maps stable database errors without exposing database messages", () => {
    expect(mapBulkRunDatabaseError({ message: "ACTIVE_DUPLICATE_RUN: 123" })).toMatchObject({ code: "ACTIVE_DUPLICATE_RUN", status: 409 });
    expect(mapBulkRunDatabaseError({ message: "INSUFFICIENT_CREDITS" })).toMatchObject({ code: "INSUFFICIENT_CREDITS", status: 429 });
    expect(mapBulkRunDatabaseError({ message: "connection password leaked" })).toMatchObject({ code: "BULK_RUN_UNAVAILABLE", status: 500 });
  });

  it("rejects an idempotency key shorter than 16 characters before reaching storage", async () => {
    const service = createBulkRunService({ createRun: async () => { throw new Error("must not reach storage"); } });
    await expect(service.createOrReplayRun({ userId: "user-1", source: "web", idempotencyKey: "short", emails: ["one@example.com"] }))
      .rejects.toMatchObject({ code: "INVALID_IDEMPOTENCY_KEY" } satisfies Partial<BulkRunServiceError>);
  });
});
