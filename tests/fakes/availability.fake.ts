// In-memory fake of AvailabilityRepository (src/modules/availability/repository.ts), for
// unit testing AvailabilityService without a real database.
//
// The one thing this fake MUST get right to be useful at all is `claimSlot`'s atomicity
// (BR-AVAIL-5): repository.ts documents that the real (Step 17) Prisma-backed
// implementation enforces slot-uniqueness via a `(groomerId, slotStart)` unique DB
// constraint and throws `SlotConstraintViolationError` when a concurrent caller loses the
// race ("insert-and-catch-constraint-violation", nfr-design-patterns.md). This fake
// reproduces that guarantee with an in-memory "claimed start times" set: an `await`
// (simulating real async I/O latency) happens BEFORE the check-and-set, so concurrent
// callers genuinely race to reach the check — but the check-and-set itself is one
// synchronous step with no `await` in between, exactly mirroring how a real unique index
// makes the DB's own check-and-insert atomic. Whichever concurrent call's continuation
// reaches that synchronous step first (order is intentionally randomized below) wins;
// every other call throws `SlotConstraintViolationError`, same as the real constraint
// would. There is only one groomer in v1 (FR-2), so keying uniqueness on `start` alone
// (rather than `(groomerId, start)`) is a faithful simplification.

import { randomUUID } from "node:crypto";
import type { AvailabilityRepository, ClaimSlotInput, OccupiedRange } from "@/modules/availability/repository";
import { SlotConstraintViolationError } from "@/modules/availability/errors";
import type { TimeOff, TimeOffCreateInput, WorkingHoursRule, WorkingHoursRuleInput } from "@/modules/availability/types";

export interface FakeAvailabilityRepository extends AvailabilityRepository {
  _workingHours: WorkingHoursRule[];
  _timeOffs: TimeOff[];
  _occupied: Map<string, { start: Date; end: Date }>;
  _claimedStartKeys: Set<number>;
}

/** A full 7-day Mon-Sun 09:00-17:00 schedule — a convenient default for tests that don't care about hours specifically. */
export function everydayOpenSchedule(open = "09:00", close = "17:00"): WorkingHoursRuleInput[] {
  const days: WorkingHoursRuleInput["dayOfWeek"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((dayOfWeek) => ({ dayOfWeek, isOpen: true, openTime: open, closeTime: close }));
}

export function createFakeAvailabilityRepository(): FakeAvailabilityRepository {
  const occupied = new Map<string, { start: Date; end: Date }>();
  const claimedStartKeys = new Set<number>();
  const state = {
    workingHours: [] as WorkingHoursRule[],
    timeOffs: [] as TimeOff[],
  };

  /** Small random jitter so concurrent claimSlot calls interleave unpredictably before the atomic step. */
  function jitter(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 5)));
  }

  const repo: FakeAvailabilityRepository = {
    get _workingHours() {
      return state.workingHours;
    },
    get _timeOffs() {
      return state.timeOffs;
    },
    _occupied: occupied,
    _claimedStartKeys: claimedStartKeys,

    async listWorkingHours() {
      return [...state.workingHours];
    },

    async replaceWorkingHours(rules: WorkingHoursRuleInput[]) {
      state.workingHours = rules.map((r) => ({
        id: randomUUID(),
        dayOfWeek: r.dayOfWeek,
        isOpen: r.isOpen,
        openTime: r.openTime ?? null,
        closeTime: r.closeTime ?? null,
      }));
      return [...state.workingHours];
    },

    async listTimeOff() {
      return [...state.timeOffs];
    },

    async createTimeOff(input: TimeOffCreateInput) {
      const timeOff: TimeOff = {
        id: randomUUID(),
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason ?? null,
        createdAt: new Date(),
      };
      state.timeOffs.push(timeOff);
      return timeOff;
    },

    async listOccupiedRanges(windowStart: Date, windowEnd: Date, excludeAppointmentId?: string) {
      const result: OccupiedRange[] = [];
      for (const [appointmentId, range] of occupied) {
        if (appointmentId === excludeAppointmentId) continue;
        // Generous overlap window per the interface's contract — half-open overlap check.
        if (range.start.getTime() < windowEnd.getTime() && range.end.getTime() > windowStart.getTime()) {
          result.push({ appointmentId, start: range.start, end: range.end });
        }
      }
      return result;
    },

    async listFutureOccupiedRanges(fromDate: Date) {
      const result: OccupiedRange[] = [];
      for (const [appointmentId, range] of occupied) {
        if (range.end.getTime() >= fromDate.getTime()) {
          result.push({ appointmentId, start: range.start, end: range.end });
        }
      }
      return result;
    },

    async claimSlot(input: ClaimSlotInput) {
      await jitter(); // simulate real async I/O latency before the atomic DB operation
      const key = input.start.getTime();
      // Atomic check-and-set — no `await` between the check and the write, so no
      // interleaving is possible here regardless of how many callers race to this point.
      if (claimedStartKeys.has(key)) {
        throw new SlotConstraintViolationError();
      }
      claimedStartKeys.add(key);
      occupied.set(input.appointmentId, { start: input.start, end: input.end });
    },

    async forceClaimSlot(input: ClaimSlotInput) {
      await jitter();
      // SO-3 override path — deliberately NOT atomic/uniqueness-checked (repository.ts:
      // "a true double-booking under override is expected and allowed").
      occupied.set(input.appointmentId, { start: input.start, end: input.end });
    },
  };

  return repo;
}
