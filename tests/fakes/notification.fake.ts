// In-memory fake of NotificationRepository (src/modules/notification/repository.ts), for
// unit testing NotificationService without a real database.
//
// `findDueReminders` (Flow 3) must pair each due `ScheduledReminder` with its full
// `AppointmentWithLineItems` — this fake doesn't hold Appointments itself (that's
// `booking`'s table, per repository.ts's header comment), so the caller supplies a
// `getAppointment` lookup: either a plain in-memory map the test populates directly
// (notification.test.ts, exercising `notification` in isolation), or
// `tests/fakes/booking.fake.ts`'s own `_appointments` map (booking.test.ts, wiring the
// real NotificationService as booking's collaborator) — mirroring how `availability`'s
// fake depends only on `catalog`'s real service, not a booking-owned store.
//
// Likewise, `markAppointmentNotificationFailed` (BR-NOTIF-4) is booking's cross-module
// write onto `Appointment.notificationFailed` (repository.ts's header comment) — an
// optional `onMarkFailed` hook lets booking.test.ts forward it onto the SAME fake
// Appointment row `_appointments` holds (via `FakeBookingRepository._setNotificationFailed`).
// Every call is also recorded in `_notificationFailedCalls` regardless, so a test can
// assert on it directly even with no hook wired.

import { randomUUID } from "node:crypto";
import type { AppointmentWithLineItems } from "@/modules/booking";
import type { CreateScheduledReminderInput, DueReminder, NotificationRepository } from "@/modules/notification/repository";
import type { ScheduledReminder } from "@/modules/notification/types";

export interface FakeNotificationRepositoryDeps {
  getAppointment: (appointmentId: string) => AppointmentWithLineItems | null | undefined;
  onMarkFailed?: (appointmentId: string) => void;
}

export interface FakeNotificationRepository extends NotificationRepository {
  _reminders: Map<string, ScheduledReminder>;
  _notificationFailedCalls: string[];
}

export function createFakeNotificationRepository(deps: FakeNotificationRepositoryDeps): FakeNotificationRepository {
  const { getAppointment, onMarkFailed } = deps;
  const reminders = new Map<string, ScheduledReminder>();
  const notificationFailedCalls: string[] = [];

  return {
    _reminders: reminders,
    _notificationFailedCalls: notificationFailedCalls,

    async createScheduledReminder(input: CreateScheduledReminderInput) {
      const reminder: ScheduledReminder = {
        id: randomUUID(),
        appointmentId: input.appointmentId,
        sendAt: input.sendAt,
        status: "Pending",
      };
      reminders.set(reminder.id, reminder);
      return reminder;
    },

    async findPendingReminderByAppointmentId(appointmentId) {
      for (const reminder of reminders.values()) {
        if (reminder.appointmentId === appointmentId && reminder.status === "Pending") {
          return reminder;
        }
      }
      return null;
    },

    async updateReminderStatus(reminderId, status) {
      const existing = reminders.get(reminderId);
      if (!existing) return; // defensive — callers always look the row up first
      reminders.set(reminderId, { ...existing, status });
    },

    async findDueReminders(now: Date) {
      const due: DueReminder[] = [];
      for (const reminder of reminders.values()) {
        if (reminder.status !== "Pending" || !reminder.sendAt || reminder.sendAt.getTime() > now.getTime()) {
          continue;
        }
        const appointment = getAppointment(reminder.appointmentId);
        if (appointment) {
          due.push({ reminder, appointment });
        }
      }
      return due;
    },

    async markAppointmentNotificationFailed(appointmentId) {
      notificationFailedCalls.push(appointmentId);
      onMarkFailed?.(appointmentId);
    },
  };
}
