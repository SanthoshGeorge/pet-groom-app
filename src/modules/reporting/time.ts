// Internal date/period math for the reporting module. Not part of the public barrel
// (index.ts) — used only by service.ts. Same "shop wall-clock time stored using UTC field
// accessors" convention as availability/time.ts and notification/time.ts (no shop
// timezone has been specified by any artifact yet).

function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * BR-REPORT-1 — "the current calendar week (Monday-Sunday)", as a half-open
 * `[monday, nextMonday)` range covering the full week including Sunday.
 */
export function currentWeekRange(now: Date): { start: Date; end: Date } {
  const today = startOfUTCDay(now);
  const dayOfWeek = today.getUTCDay(); // 0=Sun .. 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon=0 .. Sun=6
  const monday = addDays(today, -daysSinceMonday);
  return { start: monday, end: addDays(monday, 7) };
}

/** BR-REPORT-1 — "the current calendar month", as a half-open `[1st, next 1st)` range. */
export function currentMonthRange(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}
