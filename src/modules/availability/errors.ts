// availability module error types — thrown by service.ts (and, per the documented
// contract, by repository.ts implementations), mapped to HTTP responses by the API layer
// (Code Generation Step 12/13, out of scope here).

export class AvailabilityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvailabilityValidationError";
  }
}

/**
 * BR-AVAIL-6 (Q5=A) — the sole failure outcome of `claimSlot`. Thrown whether the slot is
 * unavailable because of hours/time-off/an existing overlap (the pre-check) or because a
 * concurrent caller won the race (BR-AVAIL-5, translated from a `SlotConstraintViolationError`
 * thrown by the repository — see below). Deliberately generic either way: `availability`
 * does not compute or return an alternative slot as part of the failure (no auto-suggestion).
 */
export class SlotNotAvailableError extends Error {
  constructor(message = "This slot is no longer available") {
    super(message);
    this.name = "SlotNotAvailableError";
  }
}

/**
 * The repository-layer error `AvailabilityRepository.claimSlot` must throw when the
 * underlying atomic claim loses a race (nfr-design-patterns.md's "insert-and-catch-
 * constraint-violation" pattern — the Prisma-backed implementation, Step 17, throws this
 * after catching a real Postgres unique-constraint violation on `(groomerId, slotStart)`).
 * `AvailabilityService.claimSlot` catches this and translates it into `SlotNotAvailableError`
 * (BR-AVAIL-5/BR-AVAIL-6) — never let this type leak past this module's own service layer.
 */
export class SlotConstraintViolationError extends Error {
  constructor(message = "Slot claim lost a concurrent race") {
    super(message);
    this.name = "SlotConstraintViolationError";
  }
}

/** `getAvailableSlots` was called with a `serviceId` that `catalog.getService` can't resolve. */
export class ServiceNotFoundError extends Error {
  constructor(serviceId: string) {
    super(`Service not found: ${serviceId}`);
    this.name = "ServiceNotFoundError";
  }
}
