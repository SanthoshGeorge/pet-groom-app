// In-memory fake of BookingRepository (src/modules/booking/repository.ts), for unit
// testing BookingService without a real database.
//
// `notification`'s `markAppointmentNotificationFailed` (BR-NOTIF-4) writes onto this
// module's own Appointment row (see booking's types.ts header comment and
// notification/repository.ts's header comment on that cross-module write) — this fake
// exposes `_setNotificationFailed` as a test-only escape hatch so tests/fakes/notification.fake.ts
// can be wired to actually flip the flag on the SAME in-memory Appointment this fake
// holds, exercising the real cross-module effect rather than stubbing it out.

import { randomUUID } from "node:crypto";
import { BookingReferenceCollisionError } from "@/modules/booking/errors";
import type { BookingRepository, CreateAppointmentInput, UpdateStatusInput } from "@/modules/booking/repository";
import type { AppointmentWithLineItems, DateRange } from "@/modules/booking/types";
import type { Groomer } from "@/modules/customer";

export interface FakeBookingRepository extends BookingRepository {
  _appointments: Map<string, AppointmentWithLineItems>;
  /** Swap or clear the single FR-2 default groomer (defaults to one active Groomer). */
  setDefaultGroomer(groomer: Groomer | null): void;
  /** Test-only escape hatch for notification's cross-module `notificationFailed` write — see header comment. */
  _setNotificationFailed(appointmentId: string): void;
}

function makeDefaultGroomer(): Groomer {
  return { id: randomUUID(), name: "Default Groomer", active: true, createdAt: new Date() };
}

export function createFakeBookingRepository(): FakeBookingRepository {
  const appointments = new Map<string, AppointmentWithLineItems>();
  let groomer: Groomer | null = makeDefaultGroomer();

  return {
    _appointments: appointments,

    setDefaultGroomer(g) {
      groomer = g;
    },

    _setNotificationFailed(appointmentId) {
      const existing = appointments.get(appointmentId);
      if (existing) {
        appointments.set(appointmentId, { ...existing, notificationFailed: true });
      }
    },

    async findDefaultGroomer() {
      return groomer;
    },

    async createAppointment(input: CreateAppointmentInput) {
      for (const existing of appointments.values()) {
        if (existing.bookingReference === input.bookingReference) {
          throw new BookingReferenceCollisionError(); // BR-BOOK-8 — service.ts catches and retries
        }
      }
      const appointment: AppointmentWithLineItems = {
        id: input.id,
        bookingReference: input.bookingReference,
        ownerId: input.ownerId,
        groomerId: input.groomerId,
        slotStart: input.slotStart,
        slotEnd: input.slotEnd,
        status: input.status,
        createdBy: input.createdBy,
        isOverride: input.isOverride,
        hasConflict: input.hasConflict,
        flaggedForReview: false,
        notificationFailed: false,
        visitNotes: input.visitNotes,
        cancelledAt: null,
        cancelledBy: null,
        createdAt: new Date(),
        lineItems: input.lineItems.map((li) => ({
          id: randomUUID(),
          appointmentId: input.id,
          petId: li.petId,
          serviceId: li.serviceId,
          priceSnapshot: li.priceSnapshot,
          durationSnapshotMinutes: li.durationSnapshotMinutes,
        })),
      };
      appointments.set(appointment.id, appointment);
      return appointment;
    },

    async findAppointmentById(appointmentId) {
      return appointments.get(appointmentId) ?? null;
    },

    async findAppointmentByReference(bookingReference) {
      for (const appointment of appointments.values()) {
        if (appointment.bookingReference === bookingReference) return appointment;
      }
      return null;
    },

    async updateStatus(appointmentId, fields: UpdateStatusInput) {
      const existing = appointments.get(appointmentId);
      if (!existing) throw new Error(`fake: no appointment ${appointmentId}`);
      const updated: AppointmentWithLineItems = {
        ...existing,
        status: fields.status,
        cancelledAt: fields.cancelledAt !== undefined ? fields.cancelledAt : existing.cancelledAt,
        cancelledBy: fields.cancelledBy !== undefined ? fields.cancelledBy : existing.cancelledBy,
      };
      appointments.set(appointmentId, updated);
      return updated;
    },

    async updateSlot(appointmentId, fields) {
      const existing = appointments.get(appointmentId);
      if (!existing) throw new Error(`fake: no appointment ${appointmentId}`);
      const updated: AppointmentWithLineItems = { ...existing, slotStart: fields.slotStart, slotEnd: fields.slotEnd };
      appointments.set(appointmentId, updated);
      return updated;
    },

    async updateVisitNotes(appointmentId, visitNotes) {
      const existing = appointments.get(appointmentId);
      if (!existing) throw new Error(`fake: no appointment ${appointmentId}`);
      const updated: AppointmentWithLineItems = { ...existing, visitNotes };
      appointments.set(appointmentId, updated);
      return updated;
    },

    async listByOwner(ownerId) {
      return [...appointments.values()].filter((a) => a.ownerId === ownerId);
    },

    async listByDateRange(range: DateRange) {
      return [...appointments.values()].filter(
        (a) => a.slotStart.getTime() >= range.start.getTime() && a.slotStart.getTime() < range.end.getTime(),
      );
    },

    async setFlaggedForReview(appointmentIds, flagged) {
      for (const id of appointmentIds) {
        const existing = appointments.get(id);
        if (existing) {
          appointments.set(id, { ...existing, flaggedForReview: flagged });
        }
      }
    },
  };
}
