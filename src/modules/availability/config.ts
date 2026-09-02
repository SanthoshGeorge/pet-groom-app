// Configuration constants — availability-domain-entities.md "Configuration Constants".
// Fixed, code-level values (not runtime-admin-editable in v1); changing any of these is
// a Code Generation-level change, per that file's notes on each constant.

/** BUFFER_MINUTES (Q2=A) — fixed, system-wide trailing buffer after every appointment (BR-AVAIL-2). */
export const BUFFER_MINUTES = 15;

/** SLOT_GRID_MINUTES (Q3=A) — fixed grid interval for candidate slot start times (BR-AVAIL-3). */
export const SLOT_GRID_MINUTES = 15;

/** ADVANCE_BOOKING_DAYS (Q4=A) — how far ahead availability is computed/shown (BR-AVAIL-4). */
export const ADVANCE_BOOKING_DAYS = 14;
