import { describe, expect, it } from "vitest";
import { getMonthlyCycle, isCycleInsidePaidPeriod } from "@/lib/credit-cycle";

describe("anchored monthly credit cycles", () => {
  it("anchors paid cycles to the purchase timestamp", () => {
    expect(getMonthlyCycle("2026-08-15T10:30:00.000Z", new Date("2026-09-16T00:00:00.000Z"))).toEqual({
      start: "2026-09-15T10:30:00.000Z",
      end: "2026-10-15T10:30:00.000Z",
      cycleKey: "2026-09-15T10:30:00.000Z",
    });
  });

  it("clamps short months without losing the original anchor day", () => {
    const anchor = "2026-01-31T08:00:00.000Z";
    expect(getMonthlyCycle(anchor, new Date("2026-02-28T12:00:00.000Z")).start).toBe("2026-02-28T08:00:00.000Z");
    expect(getMonthlyCycle(anchor, new Date("2026-03-31T12:00:00.000Z")).start).toBe("2026-03-31T08:00:00.000Z");
  });

  it("handles leap years, 29/30-day anchors, cross-year cycles, and exact boundaries", () => {
    expect(getMonthlyCycle("2024-01-29T08:00:00.000Z", new Date("2024-02-29T08:00:00.000Z")).start)
      .toBe("2024-02-29T08:00:00.000Z");
    expect(getMonthlyCycle("2026-01-30T08:00:00.000Z", new Date("2026-02-28T07:59:59.999Z")).start)
      .toBe("2026-01-30T08:00:00.000Z");
    expect(getMonthlyCycle("2026-01-30T08:00:00.000Z", new Date("2026-02-28T08:00:00.000Z")).start)
      .toBe("2026-02-28T08:00:00.000Z");
    expect(getMonthlyCycle("2026-12-15T08:00:00.000Z", new Date("2027-01-15T08:00:00.001Z")).start)
      .toBe("2027-01-15T08:00:00.000Z");
  });

  it("requires explicit timezone and a valid paid period", () => {
    expect(() => getMonthlyCycle("2026-01-31T08:00:00", new Date("2026-02-01T00:00:00.000Z")))
      .toThrow("INVALID_CREDIT_ANCHOR");
    expect(() => isCycleInsidePaidPeriod(
      "2026-09-15T10:30:00.000Z",
      "2027-08-15T10:30:00.000Z",
      "2026-08-15T10:30:00.000Z",
    )).toThrow("INVALID_PAID_PERIOD");
  });

  it("rejects dates before the anchor and checks paid-period coverage", () => {
    expect(() => getMonthlyCycle("2026-08-15T10:30:00.000Z", new Date("2026-08-14T00:00:00.000Z"))).toThrow("CREDIT_CYCLE_NOT_STARTED");
    expect(isCycleInsidePaidPeriod("2026-09-15T10:30:00.000Z", "2026-08-15T10:30:00.000Z", "2027-08-15T10:30:00.000Z")).toBe(true);
    expect(isCycleInsidePaidPeriod("2027-08-15T10:30:00.000Z", "2026-08-15T10:30:00.000Z", "2027-08-15T10:30:00.000Z")).toBe(false);
  });
});
