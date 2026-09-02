// notification module data-access contract — pure interface, no implementation. Business
// logic (service.ts) depends only on this abstraction, never on Prisma directly. A
// Prisma-backed implementation is wired in during Phase F, Step 17 — it owns both the
// `ScheduledReminder` table and (per the Cross-Module Note in
// notification-business-logic-model.md) the write path for the `Appointment`-owned
// `notificationFailed` flag, the same "leaf/dependency component writes a specific flag
// onto the hub entity" pattern `availability` already uses for `flaggedForReview`.

import type { AppointmentWithLineItems } from "@/modules/booking";
import type { ScheduledReminder } from "./types";

export interface CreateScheduledReminderInput {
  appointmentId: string;
  /** Always set — an immediate send (BR-NOTIF-2) never calls this (see service.ts). */
  sendAt: Date;
}

/** One due reminder (Flow 3), paired with the full appointment data needed to actually send it. */
export interface DueReminder {
  reminder: ScheduledReminder;
  appointment: AppointmentWithLineItems;
}

export interface NotificationRepository {
  /** Flow 2, step 3 (BR-NOTIF-1) — always created with `status: "Pending"`. */
  createScheduledReminder(input: CreateScheduledReminderInput): Promise<ScheduledReminder>;

  /** BR-NOTIF-5, Flow 4 step 1 — the still-`Pending` reminder for this appointment, if any (at most one per the schema's cardinality note). */
  findPendingReminderByAppointmentId(appointmentId: string): Promise<ScheduledReminder | null>;

  /** Sets `ScheduledReminder.status` — `Cancelled` (Flow 4) or `Sent` (Flow 3, step 4). */
  updateReminderStatus(reminderId: string, status: ScheduledReminder["status"]): Promise<void>;

  /** Flow 3, step 1 — every `Pending` reminder whose `sendAt <= now`, each paired with its Appointment (with line items) to send from. */
  findDueReminders(now: Date): Promise<DueReminder[]>;

  /**
   * BR-NOTIF-4 — flags the (booking-owned) `Appointment` row. Idempotent (setting an
   * already-`true` flag is a no-op in effect); `notification` never resets it back to
   * `false` in v1 — no retry/resend flow is built (NFR Design's Resilience Patterns:
   * "no automatic retry"; a manual resend is flagged there as a v2 addition).
   */
  markAppointmentNotificationFailed(appointmentId: string): Promise<void>;
}
