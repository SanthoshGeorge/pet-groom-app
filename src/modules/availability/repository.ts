// availability module data-access contract — pure interface, no implementation. Business
// logic (service.ts) depends only on this abstraction, never on Prisma directly. A
// Prisma-backed implementation is wired in during Phase F, Step 17.

import type { TimeOff, TimeOffCreateInput, WorkingHoursRule, WorkingHoursRuleInput } from "./types";

export interface OccupiedRange {
  appointmentId: string;
  start: Date;
  end: Date;
}

export interface ClaimSlotInput {
  appointmentId: string;
  start: Date;
  end: Date;
}

export interface AvailabilityRepository {
  /** Always 7 rows (one per day of week) once `setWorkingHours` has been called at least once; see availability-domain-entities.md's constraint note. */
  listWorkingHours(): Promise<WorkingHoursRule[]>;
  /** BR-AVAIL-7 (Flow 5, step 1) — wholesale replace of all 7 rows. */
  replaceWorkingHours(rules: WorkingHoursRuleInput[]): Promise<WorkingHoursRule[]>;

  listTimeOff(): Promise<TimeOff[]>;
  /** BR-AVAIL-8 (Flow 6, step 1). */
  createTimeOff(input: TimeOffCreateInput): Promise<TimeOff>;

  /**
   * Booked appointments (owned by `booking`; Cancelled/NoShow rows are never returned —
   * BR-AVAIL-11's "a cancelled appointment's time never stays blocked") whose
   * `[slotStart, slotEnd)` range could intersect `[windowStart, windowEnd]`. A loose,
   * generous window is fine — the business logic layer applies the exact buffer-aware
   * overlap check itself. `excludeAppointmentId`, when given, omits that appointment's
   * own row (used by `booking`'s reschedule flow via `claimSlot`, so an appointment being
   * moved never conflicts with its own current slot).
   */
  listOccupiedRanges(windowStart: Date, windowEnd: Date, excludeAppointmentId?: string): Promise<OccupiedRange[]>;

  /**
   * Same as `listOccupiedRanges`, but bounded only by a lower start date (no upper bound)
   * — used by `setWorkingHours`/`addTimeOff` (BR-AVAIL-9, Flows 5 & 6 step 2) to find
   * every future Booked appointment that might now fall outside the shop's hours or
   * inside newly-added time off, regardless of how far ahead `ADVANCE_BOOKING_DAYS`
   * normally bounds availability reads.
   */
  listFutureOccupiedRanges(fromDate: Date): Promise<OccupiedRange[]>;

  /**
   * BR-AVAIL-5 — the atomic claim attempt (insert-and-catch-constraint-violation, per
   * nfr-design-patterns.md's Resilience Patterns). MUST throw `SlotConstraintViolationError`
   * (./errors) when the underlying uniqueness guarantee is violated by a concurrent
   * caller; the Prisma-backed implementation (Step 17) is what actually enforces this
   * against the real `(groomerId, slotStart)` database constraint. This module's business
   * logic (service.ts) only needs to react correctly to that outcome — see its header
   * comment.
   */
  claimSlot(input: ClaimSlotInput): Promise<void>;

  /**
   * SO-3 override path (BR-AVAIL-10) — records the claim without BR-AVAIL-5's strict
   * atomicity guarantee, which is scoped to the normal `claimSlot` path only (that
   * requirement traces to GC-1/GC-2's double-booking edge case, not SO-3's owner-override
   * flow). A true double-booking under override is expected and allowed — the caller
   * (`booking`) has already surfaced `ForceClaimResult.conflictFlag` as a warning per
   * BR-AVAIL-10, and the owner confirms anyway.
   */
  forceClaimSlot(input: ClaimSlotInput): Promise<void>;
}
