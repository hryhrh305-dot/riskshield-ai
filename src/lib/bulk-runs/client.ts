import { MAX_CHUNK_RETRIES, MAX_PARALLEL_CHUNKS } from "@/lib/bulk-run-policy";

function retryable(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 0;
  return status === 0 || status >= 500;
}

export async function runWithConcurrency<T>(items: T[], concurrency = MAX_PARALLEL_CHUNKS, operation: (item: T) => Promise<void>) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      let attempt = 0;
      for (;;) {
        try { await operation(item); break; }
        catch (error) {
          if (!retryable(error) || attempt >= MAX_CHUNK_RETRIES) throw error;
          attempt += 1;
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}
