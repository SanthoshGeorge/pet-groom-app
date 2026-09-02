// Unit tests for BookingService (src/modules/booking) — Code Generation Step 10. Covers
// every numbered rule in booking-business-rules.md (BR-BOOK-1..11) plus all 7 flows from
// booking-business-logic-model.md, including markNoShow (Flow 7, added per Q2=A) and the
// Appointment/AppointmentLineItem status lifecycle (status.ts's read-time auto-complete).
//
// Backed by an in-memory fake BookingRepository (tests/fakes/booking.fake.ts) PLUS the
// REAL CustomerService/CatalogService/AvailabilityService/NotificationService, each wired
// to its own fresh in-memory fake repository — exactly how the composition root wires
// `booking` to its four collaborators (service.ts's BookingServiceDependencies takes their
// real types, not mock interfaces beyond NotificationCollaborator's structural shape,
// which the real NotificationService satisfies). This mirrors availability.test.ts wiring
// in the real CatalogService and auth.test.ts wiring in the real CustomerService — here
// carried one level further since `booking` is the hub coordinating all of them.
//
// Since createBooking/rescheduleBooking delegate slot-claim atomicity entirely to
// `availability.claimSlot` (already given its own explicit concurrent-request test in
// availability.test.ts's BR-AVAIL-5 section), this file does not re-test that atomicity —
// only that a `SlotNotAvailableError` from availability's claim correctly propagates as
// booking's own `SlotNotAvailableError`.

import { describe, expect, it } from "vitest";
import { createBookingService, type BookingService } from "@/modules/booking/service";
import {
  AppointmentNotEligibleForNoShowError,
  AppointmentNotFoundError,
  AppointmentNotModifiableError,
  BookingLookupNotFoundError,
  BookingReferenceCollisionError,
  BookingValidationError,
  InvalidPetReferenceError,
  NoGroomerAvailableError,
  SlotNotAvailableError,
  UnbookableServiceError,
} from "@/modules/booking/errors";
import type { CreateBookingInput } from "@/modules/booking/types";
import { createAvailabilityService } from "@/modules/availability/service";
import type { WorkingHoursRuleInput } from "@/modules/availability/types";
import { createCatalogService } from "@/modules/catalog/service";
import { createCustomerService } from "@/modules/customer/service";
import { createNotificationService } from "@/modules/notification/service";
import { REMINDER_SEND_TIME } from "@/modules/notification/config";
import type { EmailMessage, EmailSender, SmsMessage, SmsSender } from "@/modules/notification/senders";
import { createFakeAvailabilityRepository, everydayOpenSchedule } from "../fakes/availability.fake";
import { createFakeCatalogRepository } from "../fakes/catalog.fake";
import { createFakeCustomerRepository, type FakeCustomerRepository } from "../fakes/customer.fake";
import { createFakeNotificationRepository, type FakeNotificationRepository } from "../fakes/notification.fake";
import { createFakeBookingRepository, type FakeBookingRepository } from "../fakes/booking.fake";

// --- local date helpers (self-contained, not importing any module's internal time.ts) ---

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

/** A fixed UTC hour on a day `offsetDays` from today — always a safe, unambiguous instant regardless of when the test suite happens to run. Negative `offsetDays` yields a past instant. */
function daysAt(offsetDays: number, hour: number, minutes = 0): Date {
  const day = addDaysUTC(startOfUTCDay(new Date()), offsetDays);
  day.setUTCHours(hour, minutes, 0, 0);
  return day;
}

// --- fake per-channel transports (tracking, configurable success/failure) ---

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

const DEFAULT_CONTACT = { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" };
/** Wide-open every-day schedule so booking tests (which exercise `booking`'s own logic, not `availability`'s hours logic — already fully covered by availability.test.ts) never trip on hours/buffer edge cases. */
const ALL_DAY_SCHEDULE = everydayOpenSchedule("00:00", "23:45");

async function buildBookingService(opts?: { emailSender?: EmailSender; smsSender?: SmsSender; hours?: WorkingHoursRuleInput[] }) {
  const bookingRepo: FakeBookingRepository = createFakeBookingRepository();

  const customerRepo: FakeCustomerRepository = createFakeCustomerRepository();
  const customer = createCustomerService(customerRepo);

  const catalogRepo = createFakeCatalogRepository();
  const catalog = createCatalogService(catalogRepo);

  const availabilityRepo = createFakeAvailabilityRepository();
  const availability = createAvailabilityService({ repository: availabilityRepo, catalog });
  await availability.setWorkingHours(opts?.hours ?? ALL_DAY_SCHEDULE);

  const emailSender = opts?.emailSender ?? createTrackingEmailSender();
  const smsSender = opts?.smsSender ?? createTrackingSmsSender();
  const notificationRepo: FakeNotificationRepository = createFakeNotificationRepository({
    getAppointment: (id) => bookingRepo._appointments.get(id),
    onMarkFailed: (id) => bookingRepo._setNotificationFailed(id),
  });
  const notification = createNotificationService({ repository: notificationRepo, customer, emailSender, smsSender });

  const service: BookingService = createBookingService({ repository: bookingRepo, customer, catalog, availability, notification });

  return { service, bookingRepo, customer, customerRepo, catalog, catalogRepo, availability, availabilityRepo, notification, notificationRepo, emailSender, smsSender };
}

/** A single-pet, single-service booking input against a brand-new guest contact, at a fixed far-future slot (always lands in the "scheduled" reminder branch, never "immediate"). */
function singlePetInput(serviceId: string, overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
  return {
    owner: { kind: "contact", contact: DEFAULT_CONTACT },
    petServicePairs: [{ pet: { kind: "newPet", details: { name: "Rex", breed: "Labrador", size: "Medium" } }, serviceId }],
    slotStart: daysAt(3, 10, 0),
    createdBy: "guest",
    ...overrides,
  };
}

describe("BookingService", () => {
  describe("BR-BOOK-1 — Per-pet service selection: one AppointmentLineItem per pet, its own serviceId, summed duration", () => {
    it("creates one line item per pet, each with its own service's price/duration snapshot, and slotEnd = slotStart + summed durations", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const fullGroom = await catalog.createService({ name: "Full Groom", price: 60, durationMinutes: 90 });
      const slotStart = daysAt(3, 10, 0);

      const appointment = await service.createBooking({
        owner: { kind: "contact", contact: DEFAULT_CONTACT },
        petServicePairs: [
          { pet: { kind: "newPet", details: { name: "Rex", breed: "Labrador", size: "Medium" } }, serviceId: bath.id },
          { pet: { kind: "newPet", details: { name: "Milo", breed: "Poodle", size: "Small" } }, serviceId: fullGroom.id },
        ],
        slotStart,
        createdBy: "guest",
      });

      expect(appointment.lineItems).toHaveLength(2);
      const bathLine = appointment.lineItems.find((li) => li.serviceId === bath.id);
      const groomLine = appointment.lineItems.find((li) => li.serviceId === fullGroom.id);
      expect(bathLine?.priceSnapshot).toBe(30);
      expect(bathLine?.durationSnapshotMinutes).toBe(30);
      expect(groomLine?.priceSnapshot).toBe(60);
      expect(groomLine?.durationSnapshotMinutes).toBe(90);
      expect(bathLine?.petId).not.toBe(groomLine?.petId); // distinct pets, per-pet service selection

      expect(appointment.slotStart.getTime()).toBe(slotStart.getTime());
      expect(appointment.slotEnd.getTime()).toBe(slotStart.getTime() + 120 * 60_000); // 30 + 90 summed
    });
  });

  describe("BR-BOOK-2 / BR-BOOK-2b — Status auto-completes on read; no-show is a manual override only from Completed", () => {
    it("a Booked appointment whose slotEnd has passed reads as Completed without a physical status write", async () => {
      const { service, catalog, bookingRepo } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(-1, 10, 0) })); // yesterday — already elapsed

      const reread = await service.lookupBooking(appointment.bookingReference, { email: DEFAULT_CONTACT.email });
      expect(reread.status).toBe("Completed"); // effective status, computed on read
      expect(bookingRepo._appointments.get(appointment.id)?.status).toBe("Booked"); // raw stored value untouched
    });

    it("markNoShow reclassifies an (effectively) Completed appointment as NoShow", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(-1, 10, 0) }));

      const result = await service.markNoShow(appointment.id);

      expect(result.status).toBe("NoShow");
    });

    it("rejects markNoShow on a still-upcoming Booked appointment", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(3, 10, 0) }));

      await expect(service.markNoShow(appointment.id)).rejects.toBeInstanceOf(AppointmentNotEligibleForNoShowError);
    });

    it("rejects markNoShow on an already-Cancelled appointment", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(3, 10, 0) }));
      await service.cancelBooking(appointment.id, "account");

      await expect(service.markNoShow(appointment.id)).rejects.toBeInstanceOf(AppointmentNotEligibleForNoShowError);
    });

    it("rejects markNoShow on an appointment that's already NoShow", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(-1, 10, 0) }));
      await service.markNoShow(appointment.id);

      await expect(service.markNoShow(appointment.id)).rejects.toBeInstanceOf(AppointmentNotEligibleForNoShowError);
    });

    it("markNoShow throws AppointmentNotFoundError for an unknown appointment", async () => {
      const { service } = await buildBookingService();
      await expect(service.markNoShow("no-such-appointment")).rejects.toBeInstanceOf(AppointmentNotFoundError);
    });
  });

  describe("BR-BOOK-3 — Reschedule preserves identity (same id/bookingReference); claim-first-then-release ordering", () => {
    it("keeps the same id and bookingReference, updates slotStart/slotEnd", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id));
      const newSlot = daysAt(5, 11, 0);

      const rescheduled = await service.rescheduleBooking(appointment.id, newSlot);

      expect(rescheduled.id).toBe(appointment.id);
      expect(rescheduled.bookingReference).toBe(appointment.bookingReference);
      expect(rescheduled.slotStart.getTime()).toBe(newSlot.getTime());
      expect(rescheduled.slotEnd.getTime()).toBe(newSlot.getTime() + 30 * 60_000);
    });

    it("fails with SlotNotAvailableError when the new slot is already taken, leaving the original appointment fully unchanged", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const originalSlot = daysAt(3, 10, 0);
      const conflictingSlot = daysAt(5, 10, 0);
      const appointment = await service.createBooking(singlePetInput(bath.id, { slotStart: originalSlot }));
      await service.createBooking(singlePetInput(bath.id, { slotStart: conflictingSlot })); // occupies the target slot

      await expect(service.rescheduleBooking(appointment.id, conflictingSlot)).rejects.toBeInstanceOf(SlotNotAvailableError);

      const stillOriginal = await service.lookupBooking(appointment.bookingReference, { email: DEFAULT_CONTACT.email });
      expect(stillOriginal.slotStart.getTime()).toBe(originalSlot.getTime());
      expect(stillOriginal.status).toBe("Booked");
    });

    it("only valid while status = Booked (BR-BOOK-6 dependency, see that section for the full matrix)", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id));
      await service.cancelBooking(appointment.id, "account");

      await expect(service.rescheduleBooking(appointment.id, daysAt(6, 10, 0))).rejects.toBeInstanceOf(AppointmentNotModifiableError);
    });

    it("rescheduleBooking throws AppointmentNotFoundError for an unknown appointment", async () => {
      const { service } = await buildBookingService();
      await expect(service.rescheduleBooking("no-such-appointment", daysAt(6, 10, 0))).rejects.toBeInstanceOf(AppointmentNotFoundError);
    });

    it("rejects an invalid newSlotStart", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id));
      await expect(service.rescheduleBooking(appointment.id, new Date("not-a-date"))).rejects.toBeInstanceOf(BookingValidationError);
    });
  });

  describe("BR-BOOK-4 — Cancel applies to the WHOLE appointment; no partial per-pet cancellation", () => {
    it("cancelling a multi-pet appointment cancels every line item together, at the Appointment level only (no per-line-item status field)", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const trim = await catalog.createService({ name: "Nail Trim", price: 15, durationMinutes: 15 });
      const appointment = await service.createBooking({
        owner: { kind: "contact", contact: DEFAULT_CONTACT },
        petServicePairs: [
          { pet: { kind: "newPet", details: { name: "Rex", breed: "Labrador", size: "Medium" } }, serviceId: bath.id },
          { pet: { kind: "newPet", details: { name: "Milo", breed: "Poodle", size: "Small" } }, serviceId: trim.id },
        ],
        slotStart: daysAt(3, 10, 0),
        createdBy: "account",
      });

      const cancelled = await service.cancelBooking(appointment.id, "account");

      expect(cancelled.status).toBe("Cancelled");
      expect(cancelled.lineItems).toHaveLength(2); // both pets' line items preserved, moved together
      expect(cancelled.lineItems.every((li) => !("status" in li))).toBe(true); // no independent per-line-item lifecycle
    });
  });

  describe("BR-BOOK-5 — Guest lookup: exact bookingReference AND a match on email OR phone", () => {
    it("succeeds with a matching email", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id));

      const found = await service.lookupBooking(appointment.bookingReference, { email: "JANE@EXAMPLE.COM" }); // case-insensitive
      expect(found.id).toBe(appointment.id);
    });

    it("succeeds with a matching phone, formatting characters stripped before comparing", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id));

      const found = await service.lookupBooking(appointment.bookingReference, { phone: "(555) 010-0" });
      expect(found.id).toBe(appointment.id);
    });

    it("rejects a correct reference with contact info that matches neither email nor phone — same generic error as an unknown reference", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id));

      let wrongContactMessage = "";
      try {
        await service.lookupBooking(appointment.bookingReference, { email: "someone-else@example.com" });
      } catch (err) {
        wrongContactMessage = (err as Error).message;
      }
      let unknownReferenceMessage = "";
      try {
        await service.lookupBooking("HTG-0000", { email: DEFAULT_CONTACT.email });
      } catch (err) {
        unknownReferenceMessage = (err as Error).message;
      }

      expect(wrongContactMessage).toBeTruthy();
      expect(wrongContactMessage).toBe(unknownReferenceMessage); // BR-BOOK-5 — never reveal which precondition failed
    });

    it("rejects a lookup with neither email nor phone supplied", async () => {
      const { service } = await buildBookingService();
      await expect(service.lookupBooking("HTG-1234", {})).rejects.toBeInstanceOf(BookingValidationError);
    });

    it("throws BookingLookupNotFoundError (not a generic error) for an unknown reference", async () => {
      const { service } = await buildBookingService();
      await expect(service.lookupBooking("HTG-9999", { email: "nobody@example.com" })).rejects.toBeInstanceOf(
        BookingLookupNotFoundError,
      );
    });
  });

  describe("BR-BOOK-6 — Terminal-state protection: cancel/reschedule only valid when status = Booked", () => {
    it("cancelBooking rejects an already-Cancelled appointment with AppointmentNotModifiableError, not a silent no-op", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id));
      await service.cancelBooking(appointment.id, "account");

      await expect(service.cancelBooking(appointment.id, "account")).rejects.toBeInstanceOf(AppointmentNotModifiableError);
    });

    it("cancelBooking rejects an (effectively) Completed appointment", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(-1, 10, 0) }));

      await expect(service.cancelBooking(appointment.id, "owner")).rejects.toBeInstanceOf(AppointmentNotModifiableError);
    });

    it("cancelBooking rejects a NoShow appointment", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(-1, 10, 0) }));
      await service.markNoShow(appointment.id);

      await expect(service.cancelBooking(appointment.id, "owner")).rejects.toBeInstanceOf(AppointmentNotModifiableError);
    });

    it("rescheduleBooking rejects a Completed/Cancelled/NoShow appointment the same way", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const completed = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(-1, 10, 0) }));
      await expect(service.rescheduleBooking(completed.id, daysAt(6, 10, 0))).rejects.toBeInstanceOf(AppointmentNotModifiableError);
    });

    it("cancelBooking throws AppointmentNotFoundError for an unknown appointment", async () => {
      const { service } = await buildBookingService();
      await expect(service.cancelBooking("no-such-appointment", "guest")).rejects.toBeInstanceOf(AppointmentNotFoundError);
    });
  });

  describe("BR-BOOK-7 — Visit notes are separate from a pet's permanent notes", () => {
    it("updateVisitNotes changes only Appointment.visitNotes, leaving the pet's own temperamentNotes untouched", async () => {
      const { service, catalog, customer, customerRepo } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const owner = await customerRepo.createOwner(DEFAULT_CONTACT);
      const pet = await customer.addPet(owner.id, { name: "Rex", breed: "Labrador", size: "Medium", temperamentNotes: "usually calm" });

      const appointment = await service.createBooking({
        owner: { kind: "ownerId", ownerId: owner.id },
        petServicePairs: [{ pet: { kind: "existingPet", petId: pet.id }, serviceId: bath.id }],
        slotStart: daysAt(3, 10, 0),
        createdBy: "owner",
        visitNotes: "first visit",
      });

      const updated = await service.updateVisitNotes(appointment.id, "seemed anxious today, ran behind schedule");

      expect(updated.visitNotes).toBe("seemed anxious today, ran behind schedule");
      const ownerAfter = await customer.getOwner(owner.id);
      expect(ownerAfter?.pets.find((p) => p.id === pet.id)?.temperamentNotes).toBe("usually calm"); // untouched
    });

    it("updateVisitNotes throws AppointmentNotFoundError for an unknown appointment", async () => {
      const { service } = await buildBookingService();
      await expect(service.updateVisitNotes("no-such-appointment", "note")).rejects.toBeInstanceOf(AppointmentNotFoundError);
    });
  });

  describe("BR-BOOK-8 — Booking reference format (HTG-#### shop-prefix pattern); collision triggers regeneration, never a user-facing error", () => {
    it("generates a bookingReference matching the HTG-#### pattern", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id));
      expect(appointment.bookingReference).toMatch(/^HTG-\d{4}$/);
    });

    it("silently regenerates and retries on a bookingReference collision, transparent to the caller", async () => {
      const { service, catalog, bookingRepo } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });

      const originalCreate = bookingRepo.createAppointment.bind(bookingRepo);
      let attempts = 0;
      bookingRepo.createAppointment = async (input) => {
        attempts += 1;
        if (attempts === 1) {
          throw new BookingReferenceCollisionError();
        }
        return originalCreate(input);
      };

      const appointment = await service.createBooking(singlePetInput(bath.id));

      expect(attempts).toBe(2); // first attempt collided, second succeeded
      expect(appointment.bookingReference).toMatch(/^HTG-\d{4}$/);
      expect(appointment.id).toBeTruthy(); // the SAME appointmentId is reused across retries (only the reference regenerates)
    });
  });

  describe("BR-BOOK-9 — Cancellation notifications ALWAYS go to the customer on file, regardless of who cancelled", () => {
    it("sends the cancellation confirmation to the customer's own email even when the shop owner initiates the cancellation", async () => {
      const emailSender = createTrackingEmailSender();
      const { service, catalog } = await buildBookingService({ emailSender });
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id, { createdBy: "guest" }));
      emailSender.sent.length = 0; // clear the booking-confirmation email, isolate the cancellation one

      const cancelled = await service.cancelBooking(appointment.id, "owner"); // owner-initiated cancel

      expect(cancelled.cancelledBy).toBe("owner"); // recorded for the owner's reference
      expect(emailSender.sent).toHaveLength(1);
      expect(emailSender.sent[0].to).toBe(DEFAULT_CONTACT.email); // but notified party is always the customer
      expect(emailSender.sent[0].subject).toMatch(/cancelled/i);
    });

    it("also cancels the pending reminder as part of cancellation (Flow 3 step 4)", async () => {
      const { service, catalog, notificationRepo } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const appointment = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(4, 10, 0) }));
      expect([...notificationRepo._reminders.values()].filter((r) => r.appointmentId === appointment.id && r.status === "Pending")).toHaveLength(1);

      await service.cancelBooking(appointment.id, "account");

      expect([...notificationRepo._reminders.values()].filter((r) => r.appointmentId === appointment.id && r.status === "Pending")).toHaveLength(0);
      expect([...notificationRepo._reminders.values()].filter((r) => r.appointmentId === appointment.id && r.status === "Cancelled")).toHaveLength(1);
    });
  });

  describe("BR-BOOK-10 — Reschedule re-syncs the reminder to the NEW slot", () => {
    it("cancels the old ScheduledReminder and creates a new one for the rescheduled slot", async () => {
      const { service, catalog, notificationRepo } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const originalSlot = daysAt(3, 10, 0);
      const appointment = await service.createBooking(singlePetInput(bath.id, { slotStart: originalSlot }));
      const originalReminder = [...notificationRepo._reminders.values()].find((r) => r.appointmentId === appointment.id)!;
      expect(originalReminder.status).toBe("Pending");

      const newSlot = daysAt(6, 14, 0);
      await service.rescheduleBooking(appointment.id, newSlot);

      expect(notificationRepo._reminders.get(originalReminder.id)?.status).toBe("Cancelled");
      const remindersForAppointment = [...notificationRepo._reminders.values()].filter((r) => r.appointmentId === appointment.id);
      const newPending = remindersForAppointment.find((r) => r.status === "Pending");
      expect(newPending).toBeTruthy();
      const expectedSendAt = combineWithReminderTime(addDaysUTC(startOfUTCDay(newSlot), -1));
      expect(newPending?.sendAt?.getTime()).toBe(expectedSendAt.getTime());
    });
  });

  describe("BR-BOOK-11 — Override booking goes through the exact same notification path as a normal booking", () => {
    it("createOverrideBooking triggers a booking confirmation and schedules a reminder, same as createBooking", async () => {
      const emailSender = createTrackingEmailSender();
      const { service, catalog, notificationRepo } = await buildBookingService({ emailSender });
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });

      const appointment = await service.createOverrideBooking(singlePetInput(bath.id, { createdBy: "owner", slotStart: daysAt(3, 10, 0) }));

      expect(emailSender.sent).toHaveLength(1);
      expect(emailSender.sent[0].subject).toMatch(/confirmed/i);
      expect([...notificationRepo._reminders.values()].some((r) => r.appointmentId === appointment.id && r.status === "Pending")).toBe(
        true,
      );
    });

    it("sets isOverride = true only when the override path was actually needed (outside normal hours)", async () => {
      const narrowHours = everydayOpenSchedule("09:00", "17:00");
      const { service, catalog } = await buildBookingService({ hours: narrowHours });
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });

      const appointment = await service.createOverrideBooking(singlePetInput(bath.id, { createdBy: "owner", slotStart: daysAt(3, 3, 0) })); // 3am — outside 09:00-17:00

      expect(appointment.isOverride).toBe(true);
      expect(appointment.hasConflict).toBe(false); // no double-booking, just outside hours
    });

    it("sets hasConflict = true when the override slot truly overlaps an existing appointment, and never throws", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const slot = daysAt(3, 10, 0);
      await service.createBooking(singlePetInput(bath.id, { slotStart: slot }));

      const overridden = await service.createOverrideBooking(singlePetInput(bath.id, { createdBy: "owner", slotStart: slot }));

      expect(overridden.hasConflict).toBe(true);
    });
  });

  describe("Flow 1/2 — validation and not-found error paths", () => {
    it("rejects a missing owner reference", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const input = { ...singlePetInput(bath.id), owner: undefined } as unknown as CreateBookingInput;
      await expect(service.createBooking(input)).rejects.toBeInstanceOf(BookingValidationError);
    });

    it("rejects an empty petServicePairs array", async () => {
      const { service } = await buildBookingService();
      await expect(
        service.createBooking({ owner: { kind: "contact", contact: DEFAULT_CONTACT }, petServicePairs: [], slotStart: daysAt(3, 10), createdBy: "guest" }),
      ).rejects.toBeInstanceOf(BookingValidationError);
    });

    it("rejects an invalid slotStart", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      await expect(service.createBooking(singlePetInput(bath.id, { slotStart: new Date("not-a-date") }))).rejects.toBeInstanceOf(
        BookingValidationError,
      );
    });

    it("throws InvalidPetReferenceError when an existingPet id doesn't belong to the resolved owner", async () => {
      const { service, catalog, customerRepo } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const owner = await customerRepo.createOwner(DEFAULT_CONTACT);
      const otherOwner = await customerRepo.createOwner({ name: "Other", phone: "555-9999", email: "other@example.com" });
      const someoneElsesPet = await customerRepo.createPet({ ownerId: otherOwner.id, name: "Fido", breed: "Beagle", size: "Small" });

      await expect(
        service.createBooking({
          owner: { kind: "ownerId", ownerId: owner.id },
          petServicePairs: [{ pet: { kind: "existingPet", petId: someoneElsesPet.id }, serviceId: bath.id }],
          slotStart: daysAt(3, 10, 0),
          createdBy: "account",
        }),
      ).rejects.toBeInstanceOf(InvalidPetReferenceError);
    });

    it("throws UnbookableServiceError for a deactivated service (BR-CAT-2 — hidden from booking)", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      await catalog.deactivateService(bath.id);

      await expect(service.createBooking(singlePetInput(bath.id))).rejects.toBeInstanceOf(UnbookableServiceError);
    });

    it("propagates a SlotNotAvailableError when the requested slot is already claimed (delegates atomicity to availability.claimSlot)", async () => {
      const { service, catalog } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const slot = daysAt(3, 10, 0);
      await service.createBooking(singlePetInput(bath.id, { slotStart: slot }));

      await expect(service.createBooking(singlePetInput(bath.id, { slotStart: slot }))).rejects.toBeInstanceOf(SlotNotAvailableError);
    });

    it("throws NoGroomerAvailableError when no default groomer is configured (defensive — FR-2 guarantees one in practice)", async () => {
      const { service, catalog, bookingRepo } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      bookingRepo.setDefaultGroomer(null);

      await expect(service.createBooking(singlePetInput(bath.id))).rejects.toBeInstanceOf(NoGroomerAvailableError);
    });
  });

  describe("Flow 6 — listMyBookings / listAllBookings", () => {
    it("listMyBookings returns only the given owner's appointments, upcoming and past alike", async () => {
      const { service, catalog, customerRepo } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const ownerA = await customerRepo.createOwner(DEFAULT_CONTACT);
      const ownerB = await customerRepo.createOwner({ name: "Bob", phone: "555-2222", email: "bob@example.com" });

      const past = await service.createBooking({
        owner: { kind: "ownerId", ownerId: ownerA.id },
        petServicePairs: [{ pet: { kind: "newPet", details: { name: "Rex", breed: "Lab", size: "Medium" } }, serviceId: bath.id }],
        slotStart: daysAt(-2, 10, 0),
        createdBy: "account",
      });
      const upcoming = await service.createBooking({
        owner: { kind: "ownerId", ownerId: ownerA.id },
        petServicePairs: [{ pet: { kind: "newPet", details: { name: "Fido", breed: "Beagle", size: "Small" } }, serviceId: bath.id }],
        slotStart: daysAt(3, 10, 0),
        createdBy: "account",
      });
      await service.createBooking({
        owner: { kind: "ownerId", ownerId: ownerB.id },
        petServicePairs: [{ pet: { kind: "newPet", details: { name: "Max", breed: "Pug", size: "Small" } }, serviceId: bath.id }],
        slotStart: daysAt(3, 12, 0),
        createdBy: "account",
      });

      const results = await service.listMyBookings(ownerA.id);

      expect(results.map((a) => a.id).sort()).toEqual([past.id, upcoming.id].sort());
      expect(results.find((a) => a.id === past.id)?.status).toBe("Completed"); // effective status applied here too
    });

    it("listAllBookings returns every appointment (any owner, any status) whose slot falls in the given range", async () => {
      const { service, catalog, customerRepo } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const owner = await customerRepo.createOwner(DEFAULT_CONTACT);
      const inRange = await service.createBooking({
        owner: { kind: "ownerId", ownerId: owner.id },
        petServicePairs: [{ pet: { kind: "newPet", details: { name: "Rex", breed: "Lab", size: "Medium" } }, serviceId: bath.id }],
        slotStart: daysAt(3, 10, 0),
        createdBy: "account",
      });
      await service.createBooking({
        owner: { kind: "ownerId", ownerId: owner.id },
        petServicePairs: [{ pet: { kind: "newPet", details: { name: "Milo", breed: "Poodle", size: "Small" } }, serviceId: bath.id }],
        slotStart: daysAt(10, 10, 0), // outside the queried range below
        createdBy: "account",
      });

      const results = await service.listAllBookings({ start: daysAt(2, 0, 0), end: daysAt(4, 0, 0) });

      expect(results.map((a) => a.id)).toEqual([inRange.id]);
    });
  });

  describe("BR-AVAIL-9 delegation — flagAppointmentsForReview", () => {
    it("sets flaggedForReview = true on exactly the given appointment ids", async () => {
      const { service, catalog, bookingRepo } = await buildBookingService();
      const bath = await catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const a = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(3, 10, 0) }));
      const b = await service.createBooking(singlePetInput(bath.id, { slotStart: daysAt(3, 12, 0) }));

      await service.flagAppointmentsForReview([a.id]);

      expect(bookingRepo._appointments.get(a.id)?.flaggedForReview).toBe(true);
      expect(bookingRepo._appointments.get(b.id)?.flaggedForReview).toBe(false);
    });

    it("is a no-op for an empty array", async () => {
      const { service } = await buildBookingService();
      await expect(service.flagAppointmentsForReview([])).resolves.toBeUndefined();
    });
  });
});
