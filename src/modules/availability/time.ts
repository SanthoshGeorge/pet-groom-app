// Internal date/time-of-day math helpers for the availability module. Not part of the
// public barrel (index.ts) — used only by service.ts.
//
// JUDGMENT CALL: no artifact (requirements.md, tech-stack-decisions.md, nfr-*) specifies
// a shop timezone. All date/time arithmetic here is done in UTC (`getUTC*`/`setUTC*`)
// rather than the host process's local timezone, so slot-grid computation is deterministic
// regardless of where this code runs (a serverless function's local TZ is not guaranteed).
// Treat every `Date` here as "shop wall-clock time stored using UTC field accessors" —
// real shop-local-timezone handling (if ever needed) is a later, explicitly out-of-scope
// concern; flagged here rather than silently assumed away.

import type { DayOfWeek, TimeOff } from "./types";

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Half-open interval overlap: `[aStart, aEnd)` intersects `[bStart, bEnd)`. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

const DAY_BY_UTC_INDEX: readonly DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayOfWeekFromDate(date: Date): DayOfWeek {
  return DAY_BY_UTC_INDEX[date.getUTCDay()];
}

/** Trusts already-validated `"HH:mm"` input (validation.ts is responsible for rejecting malformed values before they reach here). */
export function parseTimeOfDay(value: string): { hours: number; minutes: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`invalid time-of-day value: ${value}`);
  }
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

/** Combines a calendar day (only its Y/M/D is used) with a `"HH:mm"` time-of-day into one `Date`. */
export function combineDateAndTime(day: Date, time: string): Date {
  const { hours, minutes } = parseTimeOfDay(time);
  const result = startOfUTCDay(day);
  result.setUTCHours(hours, minutes, 0, 0);
  return result;
}

/** BR-AVAIL-8 — a `TimeOff` blocks every date in its inclusive `[startDate, endDate]` range. */
export function isWithinAnyTimeOff(day: Date, timeOffs: readonly TimeOff[]): boolean {
  const d = startOfUTCDay(day).getTime();
  return timeOffs.some(
    (t) => d >= startOfUTCDay(t.startDate).getTime() && d <= startOfUTCDay(t.endDate).getTime(),
  );
}

/**
 * BR-AVAIL-4 — clamps a requested range to `[now, now + ADVANCE_BOOKING_DAYS]`, and (a
 * judgment call, not spelled out verbatim in BR-AVAIL-4 but a direct consequence of "now"
 * being the lower bound) never below the current instant — a caller cannot query, or be
 * offered, a slot in the past.
 */
export function clampDateRange(
  range: { start: Date; end: Date },
  now: Date,
  advanceDays: number,
): { start: Date; end: Date } {
  const maxEnd = addDays(startOfUTCDay(now), advanceDays);
  const start = range.start.getTime() > now.getTime() ? range.start : now;
  const end = range.end.getTime() < maxEnd.getTime() ? range.end : maxEnd;
  return { start, end };
}
