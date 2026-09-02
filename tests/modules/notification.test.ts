// Unit tests for NotificationService (src/modules/notification) — Code Generation Step 10.
// Covers every numbered rule in notification-business-rules.md (BR-NOTIF-1..7) plus all 5
// flows from notification-business-logic-model.md. Backed by an in-memory fake
// NotificationRepository (tests/fakes/notification.fake.ts) and the REAL CustomerService
// (built on a fake CustomerRepository — tests/fakes/customer.fake.ts), matching how the
// composition root actually wires `notification` to `customer` (service.ts's
// NotificationServiceDependencies takes the real CustomerService type). Configurable fake
// EmailSender/SmsSender implementations (below) let each test control per-channel
// success/failure independently, per BR-NOTIF-3.

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createNotificationService, type NotificationService } from "@/modules/notification/service";
import { REMINDER_SEND_TIME } from "@/modules/notification/config";
import type { EmailMessage, EmailSender, SmsMessage, SmsSender } from "@/modules/notification/senders";
import type { AppointmentWithLineItems } from "@/modules/booking";
import { createCustomerService } from "@/modules/customer/service";
import { createFakeCustomerRepository, type FakeCustomerRepository } from "../fakes/customer.fake";
import { createFakeNotificationRepository, type FakeNotificationRepository } from "../fakes/notification.fake";

// --- local date helpers (deliberately self-contained — not importing the module's own
// internal time.ts, so these tests exercise the public service surface only) ---

function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function combineWithReminderTime(day: Date): Date {
  const [hours, minutes] = REMINDER_SEND_TIME.split(":").map(Number);
  const result = startOfUTCDay(day);
  result.setUTCHours(hours, minutes, 0, 0);
  return result;
}

function daysFromNowAt(days: number, hours: number, minutes = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

// --- fake per-channel transports (configurable success/failure, BR-NOTIF-3) ---

function createTrackingEmailSender(shouldFail = false): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message) {
      if (shouldFail) throw new Error("simulated email failure");
      sent.push(message);
    },
  };
}

function createTrackingSmsSender(shouldFail = false): SmsSender & { sent: SmsMessage[] } {
  const sent: SmsMessage[] = [];
  return {
    sent,
    async send(message) {
      if (shouldFail) throw new Error("simulated SMS failure");
      sent.push(message);
    },
  };
}

// --- Appointment fixture builder (notification has no domain entity of its own — it
// operates on booking's AppointmentWithLineItems directly, per types.ts's header comment) ---

function buildAppointment(overrides: Partial<AppointmentWithLineItems> & { ownerId: string }): AppointmentWithLineItems {
  const id = overrides.id ?? randomUUID();
  const slotStart = overrides.slotStart ?? new Date();
  return {
    id,
    bookingReference: overrides.bookingReference ?? "HTG-0001",
    ownerId: overrides.ownerId,
    groomerId: overrides.groomerId ?? "groomer-1",
    slotStart,
    slotEnd: overrides.slotEnd ?? new Date(slotStart.getTime() + 60 * 60_000),
    status: overrides.status ?? "Booked",
    createdBy: overrides.createdBy ?? "guest",
    isOverride: overrides.isOverride ?? false,
    hasConflict: overrides.hasConflict ?? false,
    flaggedForReview: overrides.flaggedForReview ?? false,
    notificationFailed: overrides.notificationFailed ?? false,
    visitNotes: overrides.visitNotes ?? null,
    cancelledAt: overrides.cancelledAt ?? null,
    cancelledBy: overrides.cancelledBy ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    lineItems: overrides.lineItems ?? [],
  };
}

describe("NotificationService", () => {
  let customerRepository: FakeCustomerRepository;
  let notificationRepository: FakeNotificationRepository;
  let appointments: Map<string, AppointmentWithLineItems>;
  let emailSender: ReturnType<typeof createTrackingEmailSender>;
  let smsSender: ReturnType<typeof createTrackingSmsSender>;
  let service: NotificationService;
  let ownerId: string;

  /** Rebuilds `service` with the given senders (default: both succeeding) — used by tests that need a failing channel. */
  function buildService(email: EmailSender = emailSender, sms: SmsSender = smsSender): NotificationService {
    return createNotificationService({ repository: notificationRepository, customer: createCustomerService(customerRepository), emailSender: email, smsSender: sms });
  }

  beforeEach(async () => {
    customerRepository = createFakeCustomerRepository();
    appointments = new Map();
    notificationRepository = createFakeNotificationRepository({ getAppointment: (id) => appointments.get(id) });
    emailSender = createTrackingEmailSender();
    smsSender = createTrackingSmsSender();
    service = buildService();

    const owner = await customerRepository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });
    ownerId = owner.id;
  });

  function registerAppointment(overrides: Partial<AppointmentWithLineItems> = {}): AppointmentWithLineItems {
    const appointment = buildAppointment({ ownerId, ...overrides });
    appointments.set(appointment.id, appointment);
    return appointment;
  }

  describe("BR-NOTIF-1 — Reminders go out at a fixed daily time, the day before slotStart", () => {
    it("scheduleReminder creates a Pending ScheduledReminder whose sendAt is REMINDER_SEND_TIME on the day before slotStart", async () => {
      const slotStart = daysFromNowAt(3, 15, 0); // comfortably far out — always lands in the "scheduled" branch
      const appointment = registerAppointment({ slotStart });

      const result = await service.scheduleReminder(appointment);

      expect(result.mode).toBe("scheduled");
      expect(result.sendResult).toBeNull();
      expect(result.reminder).not.toBeNull();
      expect(result.reminder?.status).toBe("Pending");
      const expectedSendAt = combineWithReminderTime(addDaysUTC(startOfUTCDay(slotStart), -1));
      expect(result.reminder?.sendAt?.getTime()).toBe(expectedSendAt.getTime());
      expect(notificationRepository._reminders.size).toBe(1);
    });
  });

  describe("BR-NOTIF-2 — Short-notice bookings send the reminder immediately", () => {
    it("sends immediately (no ScheduledReminder row) when the computed day-before send time has already passed", async () => {
      // slotStart later today => "the day before" is yesterday's calendar date => its fixed
      // send time is already in the past relative to "now", regardless of current clock time.
      const slotStart = new Date(Date.now() + 30 * 60_000);
      const appointment = registerAppointment({ slotStart });

      const result = await service.scheduleReminder(appointment);

      expect(result.mode).toBe("immediate");
      expect(result.reminder).toBeNull();
      expect(result.sendResult).not.toBeNull();
      expect(notificationRepository._reminders.size).toBe(0); // no row created (BR-NOTIF-2)
      expect(emailSender.sent).toHaveLength(1); // same content/channels as a normal reminder, just sent now
      expect(smsSender.sent).toHaveLength(1);
    });
  });

  describe("BR-NOTIF-3 — Channels are independent; neither's failure affects the other", () => {
    it("SMS still sends successfully even though the email channel failed, and vice versa", async () => {
      const failingEmailService = buildService(createTrackingEmailSender(true), smsSender);
      const appointment = registerAppointment();

      const result = await failingEmailService.sendBookingConfirmation(appointment);

      expect(result.channels).toEqual(
        expect.arrayContaining([
          { channel: "email", success: false },
          { channel: "sms", success: true },
        ]),
      );
      expect(result.anyFailed).toBe(true);
      expect(smsSender.sent).toHaveLength(1); // SMS attempt was unaffected by the email failure
    });

    it("email still sends successfully even though the SMS channel failed", async () => {
      const failingSmsService = buildService(emailSender, createTrackingSmsSender(true));
      const appointment = registerAppointment();

      const result = await failingSmsService.sendBookingConfirmation(appointment);

      expect(result.channels).toEqual(
        expect.arrayContaining([
          { channel: "email", success: true },
          { channel: "sms", success: false },
        ]),
      );
      expect(emailSender.sent).toHaveLength(1);
    });

    it("both channels succeeding reports anyFailed = false", async () => {
      const appointment = registerAppointment();
      const result = await service.sendBookingConfirmation(appointment);
      expect(result.anyFailed).toBe(false);
      expect(result.channels.every((c) => c.success)).toBe(true);
    });
  });

  describe("BR-NOTIF-4 — Failed sends are flagged on the appointment (Appointment.notificationFailed)", () => {
    it("flags the appointment when only the email channel fails", async () => {
      const failingEmailService = buildService(createTrackingEmailSender(true), smsSender);
      const appointment = registerAppointment();

      await failingEmailService.sendBookingConfirmation(appointment);

      expect(notificationRepository._notificationFailedCalls).toContain(appointment.id);
    });

    it("flags the appointment when only the SMS channel fails", async () => {
      const failingSmsService = buildService(emailSender, createTrackingSmsSender(true));
      const appointment = registerAppointment();

      await failingSmsService.sendBookingConfirmation(appointment);

      expect(notificationRepository._notificationFailedCalls).toContain(appointment.id);
    });

    it("does NOT flag the appointment when both channels succeed", async () => {
      const appointment = registerAppointment();
      await service.sendBookingConfirmation(appointment);
      expect(notificationRepository._notificationFailedCalls).not.toContain(appointment.id);
    });

    it("defensively treats a missing Owner as both channels failing, without throwing", async () => {
      const appointment = buildAppointment({ ownerId: "no-such-owner" });
      appointments.set(appointment.id, appointment);

      const result = await service.sendBookingConfirmation(appointment);

      expect(result.channels).toEqual([
        { channel: "email", success: false },
        { channel: "sms", success: false },
      ]);
      expect(result.anyFailed).toBe(true);
      expect(notificationRepository._notificationFailedCalls).toContain(appointment.id);
    });
  });

  describe("BR-NOTIF-5 — Cancelling an appointment cancels its pending reminder", () => {
    it("sets a Pending ScheduledReminder to Cancelled", async () => {
      const appointment = registerAppointment({ slotStart: daysFromNowAt(3, 15, 0) });
      const { reminder } = await service.scheduleReminder(appointment);

      await service.cancelScheduledReminder(appointment.id);

      expect(notificationRepository._reminders.get(reminder!.id)?.status).toBe("Cancelled");
    });

    it("is a no-op (no error) when no ScheduledReminder exists at all for this appointment", async () => {
      await expect(service.cancelScheduledReminder("never-scheduled")).resolves.toBeUndefined();
    });

    it("is a no-op when the reminder already fired (status = Sent) — nothing left to cancel", async () => {
      const appointment = registerAppointment({ slotStart: daysFromNowAt(3, 15, 0) });
      const { reminder } = await service.scheduleReminder(appointment);
      await notificationRepository.updateReminderStatus(reminder!.id, "Sent");

      await expect(service.cancelScheduledReminder(appointment.id)).resolves.toBeUndefined();

      expect(notificationRepository._reminders.get(reminder!.id)?.status).toBe("Sent"); // unchanged
    });

    it("is a no-op when the reminder was already sent immediately (BR-NOTIF-2 — no row was ever created)", async () => {
      const appointment = registerAppointment({ slotStart: new Date(Date.now() + 30 * 60_000) });
      await service.scheduleReminder(appointment); // takes the immediate branch, creates no row

      await expect(service.cancelScheduledReminder(appointment.id)).resolves.toBeUndefined();
      expect(notificationRepository._reminders.size).toBe(0);
    });
  });

  describe("BR-NOTIF-6 — Rescheduling re-syncs the reminder", () => {
    it("cancelling the old reminder then scheduling a new one leaves exactly one Cancelled and one Pending row for the same appointment", async () => {
      const originalSlot = daysFromNowAt(3, 15, 0);
      const appointment = registerAppointment({ slotStart: originalSlot });
      const { reminder: original } = await service.scheduleReminder(appointment);

      // Simulates booking's rescheduleBooking flow (BR-BOOK-10): cancel-then-reschedule.
      await service.cancelScheduledReminder(appointment.id);
      const newSlot = daysFromNowAt(5, 11, 0);
      const rescheduled = { ...appointment, slotStart: newSlot, slotEnd: new Date(newSlot.getTime() + 60 * 60_000) };
      appointments.set(appointment.id, rescheduled);
      const { reminder: resynced } = await service.scheduleReminder(rescheduled);

      expect(notificationRepository._reminders.get(original!.id)?.status).toBe("Cancelled");
      expect(resynced?.status).toBe("Pending");
      const expectedNewSendAt = combineWithReminderTime(addDaysUTC(startOfUTCDay(newSlot), -1));
      expect(resynced?.sendAt?.getTime()).toBe(expectedNewSendAt.getTime());
    });

    it("re-syncing onto a now-short-notice slot falls through to the immediate branch instead of scheduling", async () => {
      const appointment = registerAppointment({ slotStart: daysFromNowAt(3, 15, 0) });
      await service.scheduleReminder(appointment);
      await service.cancelScheduledReminder(appointment.id);

      const newSlot = new Date(Date.now() + 30 * 60_000); // rescheduled to something happening very soon
      const rescheduled = { ...appointment, slotStart: newSlot };
      appointments.set(appointment.id, rescheduled);

      const result = await service.scheduleReminder(rescheduled);

      expect(result.mode).toBe("immediate");
    });
  });

  describe("BR-NOTIF-7 — Booking/cancellation confirmations are always immediate, never scheduled/batched", () => {
    it("sendBookingConfirmation never creates a ScheduledReminder row", async () => {
      const appointment = registerAppointment();
      await service.sendBookingConfirmation(appointment);
      expect(notificationRepository._reminders.size).toBe(0);
    });

    it("sendCancellationConfirmation never creates a ScheduledReminder row and uses cancellation-notice content", async () => {
      const appointment = registerAppointment({ status: "Cancelled", cancelledAt: new Date(), cancelledBy: "account" });
      await service.sendCancellationConfirmation(appointment);
      expect(notificationRepository._reminders.size).toBe(0);
      expect(emailSender.sent[0]?.subject).toMatch(/cancelled/i);
    });
  });

  describe("Flow 3 — Daily Reminder Job: per-reminder failure isolation", () => {
    it("processes every due reminder even when one reminder's own processing throws unexpectedly", async () => {
      const now = new Date();

      // R1: both channels succeed.
      const okAppointment = registerAppointment({ slotStart: daysFromNowAt(0, 10, 0) });
      const okReminder = await notificationRepository.createScheduledReminder({ appointmentId: okAppointment.id, sendAt: new Date(now.getTime() - 60_000) });

      // R2: a channel fails, but processing itself completes (still counted as "sent", but also as a failure).
      const partialFailAppointment = registerAppointment({ slotStart: daysFromNowAt(0, 11, 0) });
      const partialFailReminder = await notificationRepository.createScheduledReminder({ appointmentId: partialFailAppointment.id, sendAt: new Date(now.getTime() - 60_000) });

      // R3: processing throws unexpectedly (simulated repository failure marking it Sent) — must not abort the batch.
      const erroringAppointment = registerAppointment({ slotStart: daysFromNowAt(0, 12, 0) });
      const erroringReminder = await notificationRepository.createScheduledReminder({ appointmentId: erroringAppointment.id, sendAt: new Date(now.getTime() - 60_000) });

      // Give each appointment's owner a distinct email so the sender can fail selectively.
      const okOwner = await customerRepository.createOwner({ name: "OK Owner", phone: "555-1111", email: "ok@example.com" });
      appointments.set(okAppointment.id, { ...okAppointment, ownerId: okOwner.id });
      const partialOwner = await customerRepository.createOwner({ name: "Partial Owner", phone: "555-2222", email: "partial@example.com" });
      appointments.set(partialFailAppointment.id, { ...partialFailAppointment, ownerId: partialOwner.id });
      const erroringOwner = await customerRepository.createOwner({ name: "Erroring Owner", phone: "555-3333", email: "erroring@example.com" });
      appointments.set(erroringAppointment.id, { ...erroringAppointment, ownerId: erroringOwner.id });

      const selectiveEmail: EmailSender = {
        async send(message) {
          if (message.to === "partial@example.com") {
            throw new Error("simulated email failure for R2");
          }
        },
      };
      const batchService = buildService(selectiveEmail, smsSender);

      // Simulate R3's own repository step throwing unexpectedly, independent of the send outcome.
      const originalUpdateStatus = notificationRepository.updateReminderStatus.bind(notificationRepository);
      notificationRepository.updateReminderStatus = async (reminderId, status) => {
        if (reminderId === erroringReminder.id) {
          throw new Error("simulated repository failure");
        }
        return originalUpdateStatus(reminderId, status);
      };

      const result = await batchService.runDailyReminderBatch(now);

      expect(result.processed).toBe(3);
      expect(result.sent).toBe(2); // R1 and R2 both got marked Sent; R3's update threw
      expect(result.failedCount).toBe(2); // R2 (a channel failed) + R3 (processing errored)

      expect(notificationRepository._reminders.get(okReminder.id)?.status).toBe("Sent");
      expect(notificationRepository._reminders.get(partialFailReminder.id)?.status).toBe("Sent");
      expect(notificationRepository._reminders.get(erroringReminder.id)?.status).toBe("Pending"); // never got marked Sent
    });

    it("only picks up Pending reminders whose sendAt has actually arrived, ignoring future-dated, Sent, and Cancelled rows", async () => {
      const now = new Date();
      const due = registerAppointment({ slotStart: daysFromNowAt(0, 10, 0) });
      const dueReminder = await notificationRepository.createScheduledReminder({ appointmentId: due.id, sendAt: new Date(now.getTime() - 1000) });

      const notYetDue = registerAppointment({ slotStart: daysFromNowAt(3, 10, 0) });
      await notificationRepository.createScheduledReminder({ appointmentId: notYetDue.id, sendAt: new Date(now.getTime() + 60 * 60_000) });

      const alreadyCancelled = registerAppointment({ slotStart: daysFromNowAt(0, 9, 0) });
      const cancelledReminder = await notificationRepository.createScheduledReminder({ appointmentId: alreadyCancelled.id, sendAt: new Date(now.getTime() - 1000) });
      await notificationRepository.updateReminderStatus(cancelledReminder.id, "Cancelled");

      const result = await service.runDailyReminderBatch(now);

      expect(result.processed).toBe(1);
      expect(notificationRepository._reminders.get(dueReminder.id)?.status).toBe("Sent");
    });

    it("returns all-zero counts when nothing is due", async () => {
      const result = await service.runDailyReminderBatch(new Date());
      expect(result).toEqual({ processed: 0, sent: 0, failedCount: 0 });
    });
  });

  describe("Flow 1/5 — content differs between a confirmation and a cancellation notice", () => {
    it("sendBookingConfirmation's subject/body reference the booking as confirmed", async () => {
      const appointment = registerAppointment({ bookingReference: "HTG-9999" });
      await service.sendBookingConfirmation(appointment);
      expect(emailSender.sent[0]?.subject).toMatch(/confirmed/i);
      expect(emailSender.sent[0]?.subject).toContain("HTG-9999");
    });

    it("sendCancellationConfirmation's subject/body reference the cancellation", async () => {
      const appointment = registerAppointment({ bookingReference: "HTG-8888", status: "Cancelled" });
      await service.sendCancellationConfirmation(appointment);
      expect(emailSender.sent[0]?.subject).toMatch(/cancelled/i);
      expect(emailSender.sent[0]?.subject).toContain("HTG-8888");
    });
  });
});
