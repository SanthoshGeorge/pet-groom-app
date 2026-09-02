// Configuration constants — notification-business-rules.md "BR-NOTIF-1".
// Fixed, code-level value (not runtime-admin-editable in v1) — same placeholder-pending-
// real-branding-confirmation spirit as availability's BUFFER_MINUTES/SLOT_GRID_MINUTES
// (see availability/config.ts).

/**
 * REMINDER_SEND_TIME (BR-NOTIF-1) — the fixed daily reminder send time, shop wall-clock,
 * `"HH:mm"` 24-hour format. Combined with a calendar day via `./time.ts`'s
 * `combineDateAndTime`, using the same "wall-clock time stored using UTC field accessors"
 * convention as `availability/time.ts` (no shop timezone has been specified by any
 * artifact yet — flagged there, not re-litigated here).
 */
export const REMINDER_SEND_TIME = "09:00";
