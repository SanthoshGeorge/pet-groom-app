// booking module error types — thrown by service.ts, mapped to HTTP responses by the API
// layer (Code Generation Step 12/13, out of scope here).
//
// BookingLookupNotFoundError is deliberately generic per Flow 5 of business-logic-model.md
// — callers must not use anything about *which* precondition failed (unknown reference vs.
// a reference that exists but doesn't match the supplied contact info) to reveal whether a
// given booking reference is valid at all (GC-3's "cannot view or modify someone else's
// booking" edge case).

export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingValidationError";
  }
}

export class AppointmentNotFoundError extends Error {
  constructor(appointmentId: string) {
    super(`Appointment not found: ${appointmentId}`);
    this.name = "AppointmentNotFoundError";
  }
}

/** BR-BOOK-6 — cancel/reschedule/markNoShow attempted on an appointment whose (effective) status makes it ineligible. */
export class AppointmentNotModifiableError extends Error {
  constructor(message = "This appointment can no longer be modified") {
    super(message);
    this.name = "AppointmentNotModifiableError";
  }
}

/** BR-BOOK-2b — `markNoShow` is only valid from an (effectively) `Completed` appointment. */
export class AppointmentNotEligibleForNoShowError extends Error {
  constructor(message = "Only a completed appointment can be marked as a no-show") {
    super(message);
    this.name = "AppointmentNotEligibleForNoShowError";
  }
}

/** Flow 5, steps 1-2 — the SAME generic error whether the reference doesn't exist or the contact info doesn't match (BR-BOOK-5). */
export class BookingLookupNotFoundError extends Error {
  constructor(message = "No booking found matching that reference and contact information") {
    super(message);
    this.name = "BookingLookupNotFoundError";
  }
}

/** Re-thrown at this module's boundary when `availability.claimSlot`/`rescheduleBooking`'s claim attempt fails (BR-AVAIL-6, surfaced here per BR-BOOK-3's Flow 1/4 step). */
export class SlotNotAvailableError extends Error {
  constructor(message = "This slot is no longer available") {
    super(message);
    this.name = "SlotNotAvailableError";
  }
}

export class InvalidPetReferenceError extends Error {
  constructor(petId: string) {
    super(`Pet not found for this owner: ${petId}`);
    this.name = "InvalidPetReferenceError";
  }
}

export class UnbookableServiceError extends Error {
  constructor(serviceId: string) {
    super(`Service is not available for booking: ${serviceId}`);
    this.name = "UnbookableServiceError";
  }
}

/** Defensive — FR-2 guarantees exactly one active Groomer exists in v1; this should never actually fire. */
export class NoGroomerAvailableError extends Error {
  constructor(message = "No groomer is available to assign this appointment to") {
    super(message);
    this.name = "NoGroomerAvailableError";
  }
}

/** The repository-layer error `BookingRepository.createAppointment` must throw on a `bookingReference` unique-constraint collision (BR-BOOK-8) — caught internally by service.ts, which regenerates and retries; never a user-facing error. */
export class BookingReferenceCollisionError extends Error {
  constructor(message = "Booking reference collision") {
    super(message);
    this.name = "BookingReferenceCollisionError";
  }
}
