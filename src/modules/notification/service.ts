// NotificationService business logic — implements BR-NOTIF-1..7 (notification-business-
// rules.md) and all 5 flows from notification-business-logic-model.md. Pure TypeScript:
// depends only on the NotificationRepository abstraction, the injectable EmailSender/
// SmsSender transports, plus the real `CustomerService` (already built, Step 4) for owner
// contact info — `AppointmentWithLineItems` (booking, Step 7) carries only `ownerId`, not
// embedded contact details, so this module resolves the Owner itself, the same
// already-established pattern as `booking` depending directly on `customer`'s real
// exported type instead of a minimal collaborator interface.
//
// This module's public service (`NotificationService`, below) is required to structurally
// satisfy `booking`'s locally-defined `NotificationCollaborator` (booking/service.ts)
// exactly — same method names, same `AppointmentWithLineItems` parameter type (imported
// directly from `@/modules/booking`, already built), each returning something assignable
// to `Promise<unknown>`. `booking` never imports from this module (it depends only on its
// own local structural interface), so this one-directional import (`notification` ->
// `booking`, for the type) introduces no cycle.

import type { AppointmentWithLineItems } from "@/modules/booking";
import type { CustomerService, OwnerWithPets } from "@/modules/customer";
import { REMINDER_SEND_TIME } from "./config";
import type { NotificationRepository } from "./repository";
import type { EmailSender, SmsSender } from "./senders";
import { addDays, combineDateAndTime, startOfUTCDay } from "./time";
import type { NotificationSendResult, ReminderBatchResult, ScheduleReminderResult } from "./types";

export interface NotificationServiceDependencies {
  repository: NotificationRepository;
  customer: CustomerService;
  emailSender: EmailSender;
  smsSender: SmsSender;
}

/**
 * Public service. Every method below is annotated with the `booking`-facing flow it
 * implements; `sendBookingConfirmation`/`scheduleReminder`/`cancelScheduledReminder`/
 * `sendCancellationConfirmation` are the exact four methods `booking`'s
 * `NotificationCollaborator` declares (re-checked against booking/service.ts while writing
 * this) — `runDailyReminderBatch` is an addition beyond that interface (a TypeScript
 * interface allows a structurally-wider implementation), the business logic the cron route
 * (Step 14, out of scope here) will call.
 */
export interface NotificationService {
  /** Flow 1 — BR-NOTIF-3/4/7. Independent email+SMS attempts, always immediate, never blocks/fails the caller. */
  sendBookingConfirmation(appointment: AppointmentWithLineItems): Promise<NotificationSendResult>;
  /** Flow 2 — BR-NOTIF-1/2. Schedules a fixed-daily-time reminder, or sends immediately if the slot is short-notice. */
  scheduleReminder(appointment: AppointmentWithLineItems): Promise<ScheduleReminderResult>;
  /** Flow 4 — BR-NOTIF-5. Best-effort suppression; always succeeds, no-op if nothing `Pending`. */
  cancelScheduledReminder(appointmentId: string): Promise<void>;
  /** Flow 5 — BR-NOTIF-3/4/7. Same mechanics as `sendBookingConfirmation`, cancellation-notice content. */
  sendCancellationConfirmation(appointment: AppointmentWithLineItems): Promise<NotificationSendResult>;
  /** Flow 3 — the daily reminder batch job's business logic (BR-NOTIF-1/3/4). `now` defaults to the current time; overridable for the cron route's own retry/idempotency reasoning. */
  runDailyReminderBatch(now?: Date): Promise<ReminderBatchResult>;
}

/**
 * Factory taking a repository implementation plus the real `CustomerService`, and the two
 * injectable per-channel senders — Step 17 wires in the Prisma-backed
 * `NotificationRepository`; the composition root (no later than Step 12) passes the real
 * `CustomerService` instance and the real Resend-backed `EmailSender` in directly, plus
 * `createLogOnlySmsSender()` (senders.ts) for `smsSender` per Q6=B.
 */
export function createNotificationService(deps: NotificationServiceDependencies): NotificationService {
  const { repository, customer, emailSender, smsSender } = deps;

  function formatSlot(appointment: AppointmentWithLineItems): string {
    return appointment.slotStart.toUTCString();
  }

  type MessageContent = { subject: string; body: string; smsBody: string };

  function confirmationContent(appointment: AppointmentWithLineItems, owner: OwnerWithPets): MessageContent {
    return {
      subject: `Booking confirmed — ${appointment.bookingReference}`,
      body: `Hi ${owner.name}, your appointment (${appointment.bookingReference}) is confirmed for ${formatSlot(appointment)}. See you then!`,
      smsBody: `Booking ${appointment.bookingReference} confirmed for ${formatSlot(appointment)}.`,
    };
  }

  function cancellationContent(appointment: AppointmentWithLineItems, owner: OwnerWithPets): MessageContent {
    return {
      subject: `Booking cancelled — ${appointment.bookingReference}`,
      body: `Hi ${owner.name}, your appointment (${appointment.bookingReference}) originally scheduled for ${formatSlot(appointment)} has been cancelled.`,
      smsBody: `Booking ${appointment.bookingReference} (was ${formatSlot(appointment)}) has been cancelled.`,
    };
  }

  function reminderContent(appointment: AppointmentWithLineItems, owner: OwnerWithPets): MessageContent {
    return {
      subject: `Reminder — your appointment ${appointment.bookingReference}`,
      body: `Hi ${owner.name}, this is a reminder that your appointment (${appointment.bookingReference}) is coming up on ${formatSlot(appointment)}.`,
      smsBody: `Reminder: booking ${appointment.bookingReference} on ${formatSlot(appointment)}.`,
    };
  }

  /**
   * Shared mechanics behind Flow 1/5 (and the per-reminder send inside Flow 2's immediate
   * branch and Flow 3's batch loop) — attempts email AND SMS as two independent sends
   * (BR-NOTIF-3: neither's outcome affects the other), and flags
   * `Appointment.notificationFailed` if either failed (BR-NOTIF-4). Never throws — a
   * missing Owner (defensive; `booking` guarantees a valid `ownerId`) is treated as both
   * channels failing rather than propagating an error to the caller, consistent with
   * BR-NOTIF-3's "notification never blocks/gates the underlying operation."
   */
  async function sendToOwner(
    appointment: AppointmentWithLineItems,
    buildContent: (appointment: AppointmentWithLineItems, owner: OwnerWithPets) => MessageContent,
  ): Promise<NotificationSendResult> {
    const owner = await customer.getOwner(appointment.ownerId);

    const channels: NotificationSendResult["channels"] = [];

    if (!owner) {
      channels.push({ channel: "email", success: false }, { channel: "sms", success: false });
    } else {
      const content = buildContent(appointment, owner);

      let emailOk = true;
      try {
        await emailSender.send({ to: owner.email, subject: content.subject, body: content.body });
      } catch {
        emailOk = false;
      }
      channels.push({ channel: "email", success: emailOk });

      let smsOk = true;
      try {
        await smsSender.send({ to: owner.phone, body: content.smsBody });
      } catch {
        smsOk = false;
      }
      channels.push({ channel: "sms", success: smsOk });
    }

    const anyFailed = channels.some((c) => !c.success);
    if (anyFailed) {
      await repository.markAppointmentNotificationFailed(appointment.id); // BR-NOTIF-4
    }

    return { channels, anyFailed };
  }

  /** BR-NOTIF-1 — the fixed daily send time on the calendar day before `slotStart`. */
  function computeReminderSendAt(slotStart: Date): Date {
    const dayBefore = addDays(startOfUTCDay(slotStart), -1);
    return combineDateAndTime(dayBefore, REMINDER_SEND_TIME);
  }

  return {
    async sendBookingConfirmation(appointment) {
      return sendToOwner(appointment, confirmationContent); // Flow 1
    },

    async sendCancellationConfirmation(appointment) {
      return sendToOwner(appointment, cancellationContent); // Flow 5
    },

    async scheduleReminder(appointment) {
      const sendAt = computeReminderSendAt(appointment.slotStart); // Flow 2, step 1

      if (sendAt.getTime() <= Date.now()) {
        // BR-NOTIF-2 — the computed daily send time already passed (short-notice booking):
        // send the reminder right now instead, no ScheduledReminder row created.
        const sendResult = await sendToOwner(appointment, reminderContent); // Flow 2, step 2
        return { mode: "immediate", reminder: null, sendResult };
      }

      // Flow 2, step 3.
      const reminder = await repository.createScheduledReminder({ appointmentId: appointment.id, sendAt });
      return { mode: "scheduled", reminder, sendResult: null };
    },

    async cancelScheduledReminder(appointmentId) {
      const pending = await repository.findPendingReminderByAppointmentId(appointmentId); // Flow 4, step 1
      if (!pending) {
        return; // BR-NOTIF-5 — no-op: already Sent, sent immediately, or never existed
      }
      await repository.updateReminderStatus(pending.id, "Cancelled");
    },

    async runDailyReminderBatch(now = new Date()) {
      const due = await repository.findDueReminders(now); // Flow 3 trigger condition: Pending, sendAt <= now

      let sent = 0;
      let failedCount = 0;

      for (const { reminder, appointment } of due) {
        try {
          const result = await sendToOwner(appointment, reminderContent); // Flow 3, steps 1-3
          if (result.anyFailed) {
            failedCount += 1;
          }
          await repository.updateReminderStatus(reminder.id, "Sent"); // Flow 3, step 4
          sent += 1;
        } catch {
          // Defensive isolation: an unexpected error processing ONE reminder (e.g. a
          // repository call failing) must not stop the rest of the batch from running —
          // each reminder's send/mark-Sent is independent, same spirit as BR-NOTIF-3's
          // per-channel isolation applied at the per-reminder level.
          failedCount += 1;
        }
      }

      return { processed: due.length, sent, failedCount };
    },
  };
}
