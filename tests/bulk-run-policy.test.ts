import { describe, expect, it } from "vitest";
import {
  INTERNAL_CHUNK_SIZE,
  MAX_CONTACTS_PER_USER_RUN,
  MAX_PARALLEL_CHUNKS,
  computeBulkRunFingerprint,
  normalizeBulkRunEmails,
  splitIntoBulkRunChunks,
} from "@/lib/bulk-run-policy";

describe("bulk run policy", () => {
  it("normalizes, validates, and deduplicates before applying the user-run limit", () => {
    expect(normalizeBulkRunEmails([" Alice@Example.com ", "alice@example.com", "", "not-an-email", "BOB@example.com"])).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  it("rejects an empty run", () => {
    expect(() => normalizeBulkRunEmails([])).toThrow(/no valid email/i);
  });

  it.each([1, 99, 100, 101, 500, 2500, 4004, 5000])("accepts %i unique contacts", (count) => {
    const emails = Array.from({ length: count }, (_, index) => `user${index}@example.com`);
    expect(() => normalizeBulkRunEmails(emails)).not.toThrow();
  });

  it("rejects 5001 unique contacts instead of truncating", () => {
    const emails = Array.from({ length: 5001 }, (_, index) => `user${index}@example.com`);
    expect(() => normalizeBulkRunEmails(emails)).toThrow(/maximum is 5000/i);
  });

  it("accepts 5001 raw contacts when normalization leaves 5000 unique contacts", () => {
    const emails = Array.from({ length: 5000 }, (_, index) => `user${index}@example.com`);
    emails.push(" USER0@EXAMPLE.COM ");
    expect(normalizeBulkRunEmails(emails)).toHaveLength(5000);
  });

  it("uses a bounded chunk size and a maximum of two client workers", () => {
    expect(MAX_CONTACTS_PER_USER_RUN).toBe(5000);
    expect(INTERNAL_CHUNK_SIZE).toBe(50);
    expect(MAX_PARALLEL_CHUNKS).toBe(2);
    expect(splitIntoBulkRunChunks(Array.from({ length: 101 }, (_, index) => `user${index}@example.com`))).toEqual([
      Array.from({ length: 50 }, (_, index) => `user${index}@example.com`),
      Array.from({ length: 50 }, (_, index) => `user${index + 50}@example.com`),
      ["user100@example.com"],
    ]);
  });

  it("creates a canonical SHA-256 fingerprint independent of order, case, and duplicates", () => {
    const first = computeBulkRunFingerprint(["B@example.com", "a@example.com", "a@example.com"], "web", 1, "risk-v1");
    const second = computeBulkRunFingerprint([" a@EXAMPLE.com ", "b@example.com"], "web", 1, "risk-v1");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the fingerprint when source, policy, or content changes", () => {
    const base = computeBulkRunFingerprint(["a@example.com"], "web", 1, "risk-v1");
    expect(computeBulkRunFingerprint(["a@example.com"], "sheets", 1, "risk-v1")).not.toBe(base);
    expect(computeBulkRunFingerprint(["a@example.com"], "web", 2, "risk-v1")).not.toBe(base);
    expect(computeBulkRunFingerprint(["b@example.com"], "web", 1, "risk-v1")).not.toBe(base);
  });
});
