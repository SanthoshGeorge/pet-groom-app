// Date/time/money formatting for the admin site — same UTC-as-shop-wall-clock convention
// `(public)/_lib/format.ts` documents and follows (see that file's header comment for the
// full rationale: `src/modules/availability/time.ts` treats every `Date` as shop wall-clock
// time stored using UTC field accessors, so every formatter here reads with `timeZone:
// "UTC"` too, regardless of the admin's own browser timezone). A separate file, not an
// import of the public one, matching this route group's "own `_lib/api.ts`" convention.

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC",
});
const WEEKDAY_SHORT_FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const WEEKDAY_LONG_FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });
const DAY_NUMBER_FORMAT = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" });
const MONTH_SHORT_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export function formatTime(date: Date): string {
  return TIME_FORMAT.format(date);
}

export function formatWeekdayShort(date: Date): string {
  return WEEKDAY_SHORT_FORMAT.format(date);
}

export function formatDayNumber(date: Date): string {
  return DAY_NUMBER_FORMAT.format(date);
}

/** "Tue, Sept 9" */
export function formatDateShort(date: Date): string {
  return `${WEEKDAY_SHORT_FORMAT.format(date)}, ${MONTH_SHORT_FORMAT.format(date)} ${DAY_NUMBER_FORMAT.format(date)}`;
}

/** "Tuesday, Sept 9" — matches the New Booking mockup's "Today, Tue Sept 9" panel heading style. */
export function formatDateLong(date: Date): string {
  return `${WEEKDAY_LONG_FORMAT.format(date)}, ${MONTH_SHORT_FORMAT.format(date)} ${DAY_NUMBER_FORMAT.format(date)}`;
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

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** UTC calendar-day key (`"YYYY-MM-DD"`) — groups appointments by day client-side without local-timezone drift. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday=0..Sunday=6 (UTC weekday), so `startOfWeekUTC` can find the Monday of any date's week. */
function utcWeekdayMondayFirst(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

/** The Monday (UTC midnight) of the calendar week containing `date`. */
export function startOfWeekUTC(date: Date): Date {
  return addUTCDays(startOfUTCDay(date), -utcWeekdayMondayFirst(date));
}
