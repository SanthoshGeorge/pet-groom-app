// AvailabilityService business logic — implements BR-AVAIL-1..11 and all 6 flows from
// availability-business-logic-model.md. Pure TypeScript: depends only on the
// AvailabilityRepository abstraction (plus `catalog`'s real `CatalogService`, already
// built in Step 5, for the single-service duration lookup Flow 1 needs), no Prisma import.
//
// JUDGMENT CALL (documented per the Code Generation report, not a silent deviation):
// component-methods.md's literal signatures are `isSlotAvailable(slot, serviceId)` and
// `claimSlot(slot, serviceId, appointmentId)` / `forceClaimSlot(slot, serviceId, appointmentId)`.
// availability-business-logic-model.md's Cross-Module Notes explicitly override this for
// the real multi-pet flow: "`booking` is responsible for summing pet service durations
// (BR-AVAIL-1) before calling into `availability` — `availability` itself only ever
// receives one already-computed total duration per call." A single `serviceId` cannot
// represent a multi-pet visit's several different services and durations, so
// `isSlotAvailable`/`claimSlot`/`forceClaimSlot` here take a `SlotRequest`
// (`{ start, durationMinutes }`) instead of a `serviceId` — booking has already summed
// durations by the time it calls these. Only `getAvailableSlots` keeps a `serviceId`
// parameter: `Slot`'s own domain shape (availability-domain-entities.md) documents a
// `serviceId` field, and Flow 1 explicitly looks up one service's duration via
// `catalog.getService(serviceId)` for the simpler single-service "what's open for X"
// browsing view (GC-1/RC-1) — a distinct use case from the multi-pet claim path.

import type { CatalogService } from "@/modules/catalog";
import { ADVANCE_BOOKING_DAYS, BUFFER_MINUTES, SLOT_GRID_MINUTES } from "./config";
import { ServiceNotFoundError, SlotConstraintViolationError, SlotNotAvailableError } from "./errors";
import type { AvailabilityRepository, OccupiedRange } from "./repository";
import {
  addDays,
  addMinutes,
  clampDateRange,
  combineDateAndTime,
  dayOfWeekFromDate,
  isWithinAnyTimeOff,
  rangesOverlap,
  startOfUTCDay,
} from "./time";
import type {
  AddTimeOffResult,
  DateRange,
  ForceClaimResult,
  SetWorkingHoursResult,
  Slot,
  SlotRequest,
  TimeOff,
  TimeOffCreateInput,
  WorkingHoursRule,
  WorkingHoursRuleInput,
} from "./types";
import { validateDateRange, validateSlotRequest, validateTimeOffInput, validateWorkingHoursSchedule } from "./validation";

export interface AvailabilityServiceDependencies {
  repository: AvailabilityRepository;
  catalog: CatalogService;
}

export interface AvailabilityService {
  /** Flow 1 — GC-1/RC-1 display, SO-1's calendar read. BR-AVAIL-1/3/4/8. */
  getAvailableSlots(dateRange: DateRange, serviceId: string): Promise<Slot[]>;
  /** Pre-check before attempting to claim (component-methods.md). Same rules as Flow 2 step 1, without the atomic claim attempt. */
  isSlotAvailable(slot: SlotRequest): Promise<boolean>;
  /** Flow 2 — GC-2/RC-2/SO-2. BR-AVAIL-5/6. Throws `SlotNotAvailableError` on failure. */
  claimSlot(slot: SlotRequest, appointmentId: string): Promise<void>;
  /** Flow 4 — SO-3 owner override. BR-AVAIL-10. Never throws for a mere conflict — see `ForceClaimResult`. */
  forceClaimSlot(slot: SlotRequest, appointmentId: string): Promise<ForceClaimResult>;
  /** Flow 3 — BR-AVAIL-11. Unconditional; see this method's body comment for why it has nothing to persist. */
  releaseSlot(appointmentId: string): Promise<void>;
  /** Flow 5 — SO-5. BR-AVAIL-7, BR-AVAIL-9. */
  setWorkingHours(schedule: WorkingHoursRuleInput[]): Promise<SetWorkingHoursResult>;
  /** Flow 6 — SO-5. BR-AVAIL-8, BR-AVAIL-9. */
  addTimeOff(range: TimeOffCreateInput): Promise<AddTimeOffResult>;
}

/**
 * Factory taking a repository implementation plus the real `CatalogService` — Step 17
 * wires in the Prisma-backed `AvailabilityRepository`; the composition root (no later
 * than Step 12) passes the already-built `CatalogService` instance in directly, since
 * `catalog` was built in Step 5 and this module can depend on its real exported type.
 */
export function createAvailabilityService(deps: AvailabilityServiceDependencies): AvailabilityService {
  const { repository, catalog } = deps;

  /**
   * The shared "is this range free?" check behind Flow 1 (per-candidate), the
   * `isSlotAvailable` pre-check, and `claimSlot`'s pre-check (Flow 2 step 1) — BR-AVAIL-3's
   * full definition: within working hours, `[start, start+duration+BUFFER)` clear of any
   * overlapping Appointment, and the day not inside a TimeOff block (BR-AVAIL-8).
   */
  async function evaluateNormalAvailability(
    slot: SlotRequest,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const day = startOfUTCDay(slot.start);
    const dayOfWeek = dayOfWeekFromDate(slot.start);

    const rules = await repository.listWorkingHours();
    const rule = rules.find((r) => r.dayOfWeek === dayOfWeek);
    if (!rule || !rule.isOpen || !rule.openTime || !rule.closeTime) {
      return false;
    }

    const openDateTime = combineDateAndTime(day, rule.openTime);
    const closeDateTime = combineDateAndTime(day, rule.closeTime);
    const slotEnd = addMinutes(slot.start, slot.durationMinutes);
    const bufferedEnd = addMinutes(slotEnd, BUFFER_MINUTES);

    // BR-AVAIL-3 — the full buffered span must land inside working hours.
    if (slot.start.getTime() < openDateTime.getTime() || bufferedEnd.getTime() > closeDateTime.getTime()) {
      return false;
    }

    const timeOffs = await repository.listTimeOff();
    if (isWithinAnyTimeOff(day, timeOffs)) {
      return false; // BR-AVAIL-8
    }

    const occupied = await repository.listOccupiedRanges(
      addMinutes(slot.start, -BUFFER_MINUTES),
      bufferedEnd,
      excludeAppointmentId,
    );
    const hasOverlap = occupied.some((o: OccupiedRange) =>
      rangesOverlap(slot.start, bufferedEnd, o.start, addMinutes(o.end, BUFFER_MINUTES)),
    );
    return !hasOverlap;
  }

  return {
    async getAvailableSlots(dateRange, serviceId) {
      validateDateRange(dateRange);

      // Flow 1, step 2.
      const service = await catalog.getService(serviceId);
      if (!service) {
        throw new ServiceNotFoundError(serviceId);
      }
      const duration = service.durationMinutes;

      // Flow 1, step 1 (BR-AVAIL-4).
      const { start: rangeStart, end: rangeEnd } = clampDateRange(dateRange, new Date(), ADVANCE_BOOKING_DAYS);
      if (rangeStart.getTime() > rangeEnd.getTime()) {
        return [];
      }

      const rules = await repository.listWorkingHours();
      const timeOffs = await repository.listTimeOff();
      const occupied = await repository.listOccupiedRanges(
        addMinutes(rangeStart, -BUFFER_MINUTES),
        addMinutes(rangeEnd, BUFFER_MINUTES + duration),
      );

      const slots: Slot[] = [];
      for (let day = startOfUTCDay(rangeStart); day.getTime() <= rangeEnd.getTime(); day = addDays(day, 1)) {
        const dayOfWeek = dayOfWeekFromDate(day);
        const rule = rules.find((r) => r.dayOfWeek === dayOfWeek);
        if (!rule || !rule.isOpen || !rule.openTime || !rule.closeTime) {
          continue; // Flow 1, step 3a
        }
        if (isWithinAnyTimeOff(day, timeOffs)) {
          continue; // Flow 1, step 3c (BR-AVAIL-8)
        }

        const openDateTime = combineDateAndTime(day, rule.openTime);
        const closeDateTime = combineDateAndTime(day, rule.closeTime);

        for (
          let candidate = openDateTime;
          candidate.getTime() <= closeDateTime.getTime();
          candidate = addMinutes(candidate, SLOT_GRID_MINUTES)
        ) {
          const end = addMinutes(candidate, duration);
          const bufferedEnd = addMinutes(end, BUFFER_MINUTES);
          if (bufferedEnd.getTime() > closeDateTime.getTime()) {
            break; // Flow 1, step 3c bullet 1 — no more candidates can fit today
          }
          if (candidate.getTime() < rangeStart.getTime() || candidate.getTime() > rangeEnd.getTime()) {
            continue; // BR-AVAIL-4 clamp, applied per-candidate (e.g. "today" partially elapsed)
          }

          const overlap = occupied.some((o: OccupiedRange) =>
            rangesOverlap(candidate, bufferedEnd, o.start, addMinutes(o.end, BUFFER_MINUTES)),
          );
          if (overlap) {
            continue; // Flow 1, step 3c bullet 2
          }

          slots.push({ start: candidate, end, serviceId });
        }
      }

      return slots;
    },

    async isSlotAvailable(slot) {
      validateSlotRequest(slot);
      return evaluateNormalAvailability(slot);
    },

    async claimSlot(slot, appointmentId) {
      validateSlotRequest(slot);

      // Flow 2, step 1 — fast pre-check (hours/time-off/visible overlap).
      const available = await evaluateNormalAvailability(slot, appointmentId);
      if (!available) {
        throw new SlotNotAvailableError(); // BR-AVAIL-6 — no auto-suggestion
      }

      // BR-AVAIL-5 — the actual atomicity guarantee: attempt the claim and let the
      // repository's insert-and-catch-constraint-violation pattern (Step 17) be the
      // final word on whether a concurrent caller won the race since the pre-check above.
      try {
        await repository.claimSlot({
          appointmentId,
          start: slot.start,
          end: addMinutes(slot.start, slot.durationMinutes),
        });
      } catch (err) {
        if (err instanceof SlotConstraintViolationError) {
          throw new SlotNotAvailableError(); // BR-AVAIL-5/6
        }
        throw err;
      }
    },

    async forceClaimSlot(slot, appointmentId) {
      validateSlotRequest(slot);

      // Flow 4, step 1 (BR-AVAIL-10) — check ONLY appointment overlap, ignoring hours/buffer/time-off.
      const slotEnd = addMinutes(slot.start, slot.durationMinutes);
      const bufferedEnd = addMinutes(slotEnd, BUFFER_MINUTES);
      const occupied = await repository.listOccupiedRanges(addMinutes(slot.start, -BUFFER_MINUTES), bufferedEnd, appointmentId);
      const conflictFlag = occupied.some((o: OccupiedRange) =>
        rangesOverlap(slot.start, bufferedEnd, o.start, addMinutes(o.end, BUFFER_MINUTES)),
      );

      // Flow 4, step 2 — isOverride = true whenever this path was NEEDED, i.e. a normal
      // claim would not have succeeded (outside hours/buffer/time-off, or itself in conflict).
      const wouldNormallySucceed = await evaluateNormalAvailability(slot, appointmentId);
      const isOverride = !wouldNormallySucceed;

      await repository.forceClaimSlot({ appointmentId, start: slot.start, end: slotEnd });

      return { conflictFlag, isOverride };
    },

    async releaseSlot() {
      // BR-AVAIL-11 — unconditional, but availability has no data of its own to release:
      // per Flow 3, "no separate release action needed on availability's side beyond the
      // Appointment's own status change, since availability computes live from Appointment
      // data rather than a stored reservation." `booking`'s cancelBooking/rescheduleBooking
      // still call this (matching component-methods.md's interface and Flow 3/4's steps)
      // so the call site is stable if a future caching layer ever needs explicit
      // invalidation here — today it is an intentional no-op.
    },

    async setWorkingHours(schedule) {
      validateWorkingHoursSchedule(schedule); // BR-AVAIL-7

      const workingHours: WorkingHoursRule[] = await repository.replaceWorkingHours(schedule);

      // Flow 5, step 2 (BR-AVAIL-9) — find future Booked appointments no longer covered.
      const future = await repository.listFutureOccupiedRanges(new Date());
      const affectedAppointmentIds = future
        .filter((apt: OccupiedRange) => !isCoveredByHours(apt, workingHours))
        .map((apt: OccupiedRange) => apt.appointmentId);

      return { workingHours, affectedAppointmentIds };
    },

    async addTimeOff(range) {
      validateTimeOffInput(range); // BR-AVAIL-8

      const timeOff: TimeOff = await repository.createTimeOff(range);

      // Flow 6, step 2 (BR-AVAIL-9) — find future Booked appointments now inside this time off.
      const future = await repository.listFutureOccupiedRanges(new Date());
      const affectedAppointmentIds = future
        .filter((apt: OccupiedRange) => isWithinAnyTimeOff(apt.start, [timeOff]))
        .map((apt: OccupiedRange) => apt.appointmentId);

      return { timeOff, affectedAppointmentIds };
    },
  };

  /** Does `apt`'s [start, end) range still fit inside `rules`' hours for its day of week? */
  function isCoveredByHours(apt: OccupiedRange, rules: WorkingHoursRule[]): boolean {
    const day = startOfUTCDay(apt.start);
    const dayOfWeek = dayOfWeekFromDate(apt.start);
    const rule = rules.find((r) => r.dayOfWeek === dayOfWeek);
    if (!rule || !rule.isOpen || !rule.openTime || !rule.closeTime) {
      return false;
    }
    const openDateTime = combineDateAndTime(day, rule.openTime);
    const closeDateTime = combineDateAndTime(day, rule.closeTime);
    return apt.start.getTime() >= openDateTime.getTime() && apt.end.getTime() <= closeDateTime.getTime();
  }
}
