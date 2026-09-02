// Date/time/money formatting for the public site.
//
// JUDGMENT CALL: `src/modules/availability/time.ts` explicitly documents that this
// codebase has no shop-timezone concept yet and treats every `Date` as "shop wall-clock
// time stored using UTC field accessors" (its own header comment). This file follows the
// same convention on the client: every formatter below reads/renders using `timeZone:
// "UTC"` rather than the visitor's local timezone, so "9:00 AM" shown in the browser is
// the same 9:00 AM the server computed the slot grid against, regardless of where the
// visitor happens to be.

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC",
});

const WEEKDAY_SHORT_FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const DAY_NUMBER_FORMAT = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" });
const MONTH_SHORT_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const WEEKDAY_LONG_FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });

export function formatTime(date: Date): string {
  return TIME_FORMAT.format(date);
}

export function formatWeekdayShort(date: Date): string {
  return WEEKDAY_SHORT_FORMAT.format(date);
}

export function formatDayNumber(date: Date): string {
  return DAY_NUMBER_FORMAT.format(date);
}

/** "Tue, Sept 9" — matches the mockup's date-strip/summary copy exactly (short weekday, short month, no leading zero). */
export function formatDateShort(date: Date): string {
  return `${WEEKDAY_SHORT_FORMAT.format(date)}, ${MONTH_SHORT_FORMAT.format(date)} ${DAY_NUMBER_FORMAT.format(date)}`;
}

/** "TUESDAY, SEPT 9" — matches the mockup's slot-grid section label exactly (uppercase, long weekday). */
export function formatDateLabelUpper(date: Date): string {
  return `${WEEKDAY_LONG_FORMAT.format(date).toUpperCase()}, ${MONTH_SHORT_FORMAT.format(date).toUpperCase()} ${DAY_NUMBER_FORMAT.format(date)}`;
}

/** "Tue, Sept 9 · 2:00 PM" — the mockup's compact slot summary (step chips, confirmation card). */
export function formatSlotSummary(date: Date): string {
  return `${formatDateShort(date)} · ${formatTime(date)}`;
}

export function formatMoney(amount: number): string {
  if (Number.isInteger(amount)) return `$${amount}`;
  return `$${amount.toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

/** UTC calendar-day key (`"YYYY-MM-DD"`) — used to group slots by day client-side without local-timezone drift. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
