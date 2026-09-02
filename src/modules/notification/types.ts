// notification module domain types — mirrors the `ScheduledReminder` model in
// prisma/schema.prisma (the module's one piece of persisted state — see
// notification-business-rules.md's "Conceptual Entity: ScheduledReminder"). Pure
// TypeScript so business logic compiles without the (not-yet-generated) Prisma client —
// see repository.ts for the abstraction boundary.
//
// `notification` has no domain entity of its own to model an "Appointment" with — it
// operates on `booking`'s already-built `AppointmentWithLineItems` directly (imported
// where needed, e.g. service.ts/repository.ts), the same way this module's public
// service is required to structurally satisfy booking's own locally-defined
// `NotificationCollaborator`. `booking` was built in Step 7, before this module, so — like
// `booking` importing `customer`'s/`catalog`'s real types directly instead of a
// minimal-collaborator interface — importing booking's real type here is the natural,
// already-established pattern, not a new one.

/** ScheduledReminder.status — matches prisma/schema.prisma's `ReminderStatus` enum. */
export type ReminderStatus = "Pending" | "Sent" | "Cancelled";

/** notification-business-rules.md "Conceptual Entity: ScheduledReminder". */
export interface ScheduledReminder {
  id: string;
  appointmentId: string;
  /** The fixed daily send time on the day before `slotStart` (BR-NOTIF-1). Always non-null for a persisted row — an immediate send (BR-NOTIF-2) never creates one (see service.ts's `scheduleReminder`). */
  sendAt: Date | null;
  status: ReminderStatus;
}

/** One channel's outcome from an independent send attempt (BR-NOTIF-3). */
export interface NotificationChannelResult {
  channel: "email" | "sms";
  success: boolean;
}

/**
 * Flow 1/5 output — informational only, per BR-NOTIF-3: never propagated back to fail the
 * caller (`booking`'s `createBooking`/`createOverrideBooking`/`cancelBooking` all `await`
 * and discard this).
 */
export interface NotificationSendResult {
  channels: NotificationChannelResult[];
  /** True if either channel (or both) failed — the same condition that drives BR-NOTIF-4's `Appointment.notificationFailed` flag. */
  anyFailed: boolean;
}

/** Flow 2 output — which branch (BR-NOTIF-1 vs BR-NOTIF-2) `scheduleReminder` took. */
export interface ScheduleReminderResult {
  mode: "scheduled" | "immediate";
  /** Present only when `mode === "scheduled"`. */
  reminder: ScheduledReminder | null;
  /** Present only when `mode === "immediate"` (BR-NOTIF-2 sends right away, same mechanics as a confirmation). */
  sendResult: NotificationSendResult | null;
}

/** Flow 3 output — the daily batch job's summary (the cron route, Step 14, is the expected caller/logger of this). */
export interface ReminderBatchResult {
  /** Total `Pending`+due `ScheduledReminder` rows found. */
  processed: number;
  /** How many were actually sent and marked `Sent` (== `processed` unless an unexpected per-reminder error occurred — see service.ts). */
  sent: number;
  /** How many of the sent reminders had at least one channel failure (BR-NOTIF-4), plus any reminder whose processing itself errored unexpectedly. */
  failedCount: number;
}
