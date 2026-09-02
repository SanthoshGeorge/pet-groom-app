// Internal date/time-of-day math helpers for the notification module. Not part of the
// public barrel (index.ts) — used only by service.ts.
//
// Deliberately duplicated (not imported) from availability/time.ts: that file isn't part
// of availability's public barrel, and reaching into another module's internal file would
// break the same repository-abstraction-boundary discipline this module is built under.
// The subset needed here is tiny — same "shop wall-clock time stored using UTC field
// accessors" convention as availability/time.ts, for the same reason (no shop timezone
// has been specified by any artifact yet).

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Trusts a well-formed `"HH:mm"` constant (REMINDER_SEND_TIME) — no external/user input reaches this. */
function parseTimeOfDay(value: string): { hours: number; minutes: number } {
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
