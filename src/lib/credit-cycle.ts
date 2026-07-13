export type MonthlyCreditCycle = {
  start: string;
  end: string;
  cycleKey: string;
};

function parseDate(value: string, errorCode: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(errorCode);
  return parsed;
}

function boundaryForOffset(anchor: Date, monthOffset: number): Date {
  const boundary = new Date(Date.UTC(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + monthOffset,
    1,
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    anchor.getUTCMilliseconds(),
  ));
  const lastDay = new Date(Date.UTC(boundary.getUTCFullYear(), boundary.getUTCMonth() + 1, 0)).getUTCDate();
  boundary.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
  return boundary;
}

export function getMonthlyCycle(anchorIso: string, at: Date = new Date()): MonthlyCreditCycle {
  const anchor = parseDate(anchorIso, "INVALID_CREDIT_ANCHOR");
  if (Number.isNaN(at.getTime())) throw new Error("INVALID_CREDIT_CYCLE_DATE");
  if (at.getTime() < anchor.getTime()) throw new Error("CREDIT_CYCLE_NOT_STARTED");

  let offset = (at.getUTCFullYear() - anchor.getUTCFullYear()) * 12
    + at.getUTCMonth() - anchor.getUTCMonth();
  if (boundaryForOffset(anchor, offset).getTime() > at.getTime()) offset -= 1;

  const start = boundaryForOffset(anchor, offset);
  const end = boundaryForOffset(anchor, offset + 1);
  return { start: start.toISOString(), end: end.toISOString(), cycleKey: start.toISOString() };
}

export function isCycleInsidePaidPeriod(cycleStart: string, paidStart: string, paidEnd: string): boolean {
  const cycle = parseDate(cycleStart, "INVALID_CYCLE_START");
  const start = parseDate(paidStart, "INVALID_PAID_PERIOD_START");
  const end = parseDate(paidEnd, "INVALID_PAID_PERIOD_END");
  return cycle.getTime() >= start.getTime() && cycle.getTime() < end.getTime();
}
