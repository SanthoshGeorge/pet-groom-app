// availability module domain types — mirror the `WorkingHoursRule` and `TimeOff` models
// in prisma/schema.prisma, plus the computed/conceptual shapes documented in
// availability-domain-entities.md (`Slot` is a computed output, never a stored row).
// Pure TypeScript so business logic compiles without the (not-yet-generated) Prisma
// client — see repository.ts for the abstraction boundary.

/** WorkingHoursRule.dayOfWeek — availability-domain-entities.md, matches prisma/schema.prisma's `DayOfWeek` enum. */
export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/**
 * The shop's regular weekly schedule (SO-5). One row per day of the week, always 7 rows
 * total (BR-AVAIL-7 — single continuous range per day, no split/lunch-break schedules).
 *
 * `openTime`/`closeTime` are time-of-day-only values (Prisma's `@db.Time`, which carries
 * no calendar date) represented here as a plain `"HH:mm"` 24-hour string — the simplest
 * shape that needs no date component and is trivial for an admin form to produce/consume.
 * The repository implementation (Step 17) converts at the Prisma boundary, the same way
 * `catalog`'s `Service.price` converts Prisma's `Decimal` to a plain `number` (see that
 * module's types.ts header comment for the precedent).
 */
export interface WorkingHoursRule {
  id: string;
  dayOfWeek: DayOfWeek;
  /** false = closed all day (e.g. Sunday). */
  isOpen: boolean;
  /** `"HH:mm"`; null when `isOpen = false`. */
  openTime: string | null;
  /** `"HH:mm"`; null when `isOpen = false`. */
  closeTime: string | null;
}

/** Input to `setWorkingHours` — one entry per day, all 7 required (BR-AVAIL-7). */
export interface WorkingHoursRuleInput {
  dayOfWeek: DayOfWeek;
  isOpen: boolean;
  openTime?: string | null;
  closeTime?: string | null;
}

/**
 * A whole-day (or multi-day) block where no new bookings are allowed (SO-5).
 * BR-AVAIL-8 (Q7=A) — whole days only, no time-of-day fields.
 */
export interface TimeOff {
  id: string;
  /** Inclusive. */
  startDate: Date;
  /** Inclusive; equals `startDate` for a single day off. */
  endDate: Date;
  /** Shop-owner-facing note only. */
  reason: string | null;
  createdAt: Date;
}

export interface TimeOffCreateInput {
  startDate: Date;
  endDate: Date;
  reason?: string | null;
}

/**
 * A computed (not stored) open time window — the output shape of `getAvailableSlots`.
 * availability-domain-entities.md "Slot (computed)".
 */
export interface Slot {
  /** Falls on the fixed grid (BR-AVAIL-3). */
  start: Date;
  /** `start` + the service's `durationMinutes` (BR-AVAIL-1). */
  end: Date;
  /** The service this slot was computed for (duration varies by service). */
  serviceId: string;
}

/**
 * A candidate time range being checked or claimed — used by `isSlotAvailable`,
 * `claimSlot`, and `forceClaimSlot`. See service.ts's header comment for why this
 * replaces the literal `(slot, serviceId)` pair from component-methods.md: the caller
 * (`booking`) has already summed each line item's duration (BR-AVAIL-1) by the time it
 * calls these, per availability-business-logic-model.md's Cross-Module Notes ("this
 * module only knows about one duration value per call").
 */
export interface SlotRequest {
  start: Date;
  durationMinutes: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface SetWorkingHoursResult {
  workingHours: WorkingHoursRule[];
  /**
   * BR-AVAIL-9 (Flow 5) — ids of existing future Booked appointments no longer covered
   * by the new hours. Only *identifies* them — actually writing `Appointment.flaggedForReview`
   * is a `booking`-owned concern (availability-business-logic-model.md's Cross-Module
   * Notes: "the flagging mechanism itself is a `booking`-module concern... this pass only
   * establishes *when* availability changes should trigger a flag, not how the flag is
   * stored or rendered"). The caller (a future admin route, Step 12/13) is expected to
   * pass these ids to `booking`'s `flagAppointmentsForReview` (see booking/service.ts).
   */
  affectedAppointmentIds: string[];
}

export interface AddTimeOffResult {
  timeOff: TimeOff;
  /** BR-AVAIL-9 (Flow 6) — same meaning as `SetWorkingHoursResult.affectedAppointmentIds`. */
  affectedAppointmentIds: string[];
}

/** Result of `forceClaimSlot` (SO-3) — component-methods.md: "success + conflict flag (if any)". */
export interface ForceClaimResult {
  /**
   * BR-AVAIL-10 — true only when the requested range truly overlaps another already-
   * booked Appointment (real double-booking); false for a slot that's merely outside
   * normal hours/buffer/time-off. The owner is warned but not blocked either way.
   */
  conflictFlag: boolean;
  /**
   * True whenever this override path was actually NEEDED — i.e. the slot fell outside
   * normal hours/buffer/time-off and a normal `claimSlot` would not have succeeded.
   * Drives the mockup's "OVERRIDE" badge on the resulting Appointment (`booking`'s
   * concern to store/render — this only determines the fact).
   */
  isOverride: boolean;
}
