// Unit tests for AvailabilityService (src/modules/availability) — Code Generation Step 10.
// Covers every numbered rule in availability-business-rules.md (BR-AVAIL-1..11) plus all
// 6 flows from availability-business-logic-model.md. Backed by an in-memory fake
// AvailabilityRepository (tests/fakes/availability.fake.ts) and the REAL CatalogService
// (built on a fake CatalogRepository — tests/fakes/catalog.fake.ts), matching how the
// composition root actually wires `availability` to `catalog` (service.ts's
// AvailabilityServiceDependencies takes the real CatalogService type, not an interface of
// its own). BR-AVAIL-5 gets its own dedicated concurrent-request test, per the Step 10
// plan requirement.

import { describe, expect, it } from "vitest";
import { createAvailabilityService, type AvailabilityService } from "@/modules/availability/service";
import {
  AvailabilityValidationError,
  ServiceNotFoundError,
  SlotNotAvailableError,
} from "@/modules/availability/errors";
import { ADVANCE_BOOKING_DAYS, BUFFER_MINUTES, SLOT_GRID_MINUTES } from "@/modules/availability/config";
import type { WorkingHoursRuleInput } from "@/modules/availability/types";
import { createCatalogService } from "@/modules/catalog/service";
import type { Service } from "@/modules/catalog/types";
import {
  createFakeAvailabilityRepository,
  everydayOpenSchedule,
  type FakeAvailabilityRepository,
} from "../fakes/availability.fake";
import { createFakeCatalogRepository } from "../fakes/catalog.fake";

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

function sameUTCDay(a: Date, b: Date): boolean {
  return startOfUTCDay(a).getTime() === startOfUTCDay(b).getTime();
}

/** Tomorrow (always safely within [now, now + ADVANCE_BOOKING_DAYS], and always after "now") at a given UTC hour/minute. */
function tomorrowAt(hours: number, minutes = 0): Date {
  const day = addDaysUTC(startOfUTCDay(new Date()), 1);
  day.setUTCHours(hours, minutes, 0, 0);
  return day;
}

async function buildService(durationMinutes = 60, hours: WorkingHoursRuleInput[] = everydayOpenSchedule("09:00", "17:00")) {
  const availabilityRepo: FakeAvailabilityRepository = createFakeAvailabilityRepository();
  const catalogRepo = createFakeCatalogRepository();
  const catalog = createCatalogService(catalogRepo);
  const svc: AvailabilityService = createAvailabilityService({ repository: availabilityRepo, catalog });
  await svc.setWorkingHours(hours);
  const service: Service = await catalog.createService({ name: "Test Service", price: 50, durationMinutes });
  return { svc, availabilityRepo, catalog, service };
}

describe("AvailabilityService", () => {
  describe("BR-AVAIL-1 — Multi-pet duration is sequential (the caller passes one pre-summed total duration)", () => {
    it("a claim occupies the ENTIRE summed duration, not just a single service's worth", async () => {
      const { svc } = await buildService();
      const start = tomorrowAt(9, 0);
      // Two pets: a 90-min Full Groom + a 15-min Nail Trim, back-to-back = 105 min total.
      await svc.claimSlot({ start, durationMinutes: 105 }, "apt-multi-pet");

      // A slot request that only overlaps within that combined 105-minute span must fail —
      // if the module had only blocked, say, 15 minutes, this would incorrectly succeed.
      const midway = new Date(start.getTime() + 60 * 60_000); // 10:00, still inside the 09:00-10:45 span
      await expect(svc.claimSlot({ start: midway, durationMinutes: 15 }, "apt-conflict")).rejects.toBeInstanceOf(
        SlotNotAvailableError,
      );

      // Immediately after the summed duration + buffer (09:00 + 105min + 15min buffer = 11:00), it's free again.
      const afterBuffer = new Date(start.getTime() + (105 + BUFFER_MINUTES) * 60_000);
      await expect(svc.claimSlot({ start: afterBuffer, durationMinutes: 15 }, "apt-after")).resolves.toBeUndefined();
    });
  });

  describe("BR-AVAIL-2 — Buffer is a fixed, system-wide constant (BUFFER_MINUTES)", () => {
    it("rejects a slot starting immediately after another with no gap, but accepts one starting exactly BUFFER_MINUTES later", async () => {
      const { svc } = await buildService();
      const start = tomorrowAt(9, 0);
      await svc.claimSlot({ start, durationMinutes: 60 }, "apt-1"); // occupies 09:00-10:00

      const noGap = new Date(start.getTime() + 60 * 60_000); // 10:00 — no gap at all
      await expect(svc.claimSlot({ start: noGap, durationMinutes: 30 }, "apt-2")).rejects.toBeInstanceOf(SlotNotAvailableError);

      const exactlyBuffered = new Date(start.getTime() + (60 + BUFFER_MINUTES) * 60_000); // 10:15
      await expect(svc.claimSlot({ start: exactlyBuffered, durationMinutes: 30 }, "apt-3")).resolves.toBeUndefined();
    });
  });

  describe("BR-AVAIL-3 — Slot start times fall on a fixed grid, fully within hours + buffer", () => {
    it("every returned slot start is on the SLOT_GRID_MINUTES grid, and its buffered span fits before closeTime", async () => {
      const { svc, service } = await buildService(60); // 09:00-17:00 day, 60-min service
      const day = tomorrowAt(0, 0);
      const nextDay = addDaysUTC(day, 1);

      const slots = await svc.getAvailableSlots({ start: day, end: nextDay }, service.id);
      const daySlots = slots.filter((s) => sameUTCDay(s.start, day));
      expect(daySlots.length).toBeGreaterThan(0);

      const open = tomorrowAt(9, 0);
      for (const slot of daySlots) {
        const minutesFromOpen = (slot.start.getTime() - open.getTime()) / 60_000;
        expect(Number.isInteger(minutesFromOpen)).toBe(true);
        expect(minutesFromOpen % SLOT_GRID_MINUTES).toBe(0);
        expect(minutesFromOpen).toBeGreaterThanOrEqual(0);

        const bufferedEndMinutesFromOpen = minutesFromOpen + 60 + BUFFER_MINUTES;
        expect(bufferedEndMinutesFromOpen).toBeLessThanOrEqual(8 * 60); // 09:00 -> 17:00 is an 8-hour window
      }

      // And the very next 15-min grid point past the last returned slot must NOT fit (proves the boundary is exact, not just "some" slots checked).
      const lastStart = daySlots[daySlots.length - 1].start;
      const oneGridStepLater = new Date(lastStart.getTime() + SLOT_GRID_MINUTES * 60_000);
      const wouldOvershoot = oneGridStepLater.getTime() + (60 + BUFFER_MINUTES) * 60_000 > tomorrowAt(17, 0).getTime();
      expect(wouldOvershoot).toBe(true);
    });

    it("closed days (isOpen = false) contribute zero slots", async () => {
      const closedSchedule: WorkingHoursRuleInput[] = everydayOpenSchedule().map((r) => ({ ...r, isOpen: false, openTime: null, closeTime: null }));
      const { svc, service } = await buildService(60, closedSchedule);
      const day = tomorrowAt(0, 0);
      const slots = await svc.getAvailableSlots({ start: day, end: addDaysUTC(day, 1) }, service.id);
      expect(slots).toHaveLength(0);
    });
  });

  describe("BR-AVAIL-4 — Availability is computed 14 days ahead, regardless of a wider requested range", () => {
    it("never returns a slot beyond now + ADVANCE_BOOKING_DAYS even when a much wider range is requested", async () => {
      const { svc, service } = await buildService(30);
      const now = new Date();
      const farFuture = addDaysUTC(now, 40);

      const slots = await svc.getAvailableSlots({ start: now, end: farFuture }, service.id);

      const maxAllowedDay = addDaysUTC(startOfUTCDay(now), ADVANCE_BOOKING_DAYS - 1);
      for (const slot of slots) {
        expect(startOfUTCDay(slot.start).getTime()).toBeLessThanOrEqual(maxAllowedDay.getTime());
      }
      expect(slots.length).toBeGreaterThan(0); // sanity: the clamp didn't eliminate everything
    });

    it("never offers a slot before the current instant — a range that's already fully elapsed returns nothing", async () => {
      const { svc, service } = await buildService(30);
      const now = new Date();
      const alreadyPast = { start: new Date(now.getTime() - 2 * 60_000), end: new Date(now.getTime() - 1) };

      await expect(svc.getAvailableSlots(alreadyPast, service.id)).resolves.toEqual([]);
    });
  });

  describe("BR-AVAIL-5 — Slot claims must be atomic (explicit concurrent-request test)", () => {
    it("exactly one of many concurrent claimSlot calls for the SAME slot succeeds; every other call gets SlotNotAvailableError", async () => {
      const { svc, service } = await buildService(30);
      const start = tomorrowAt(9, 0);
      const callerCount = 12;

      const results = await Promise.allSettled(
        Array.from({ length: callerCount }, (_, i) =>
          svc.claimSlot({ start, durationMinutes: service.durationMinutes }, `apt-race-${i}`),
        ),
      );

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(callerCount - 1);
      for (const r of rejected) {
        // BR-AVAIL-5/6 — the repository's SlotConstraintViolationError must never leak past
        // this module; every loser sees the same translated SlotNotAvailableError.
        expect(r.reason).toBeInstanceOf(SlotNotAvailableError);
      }
    });

    it("after the race, exactly one claim is actually recorded as occupying the slot", async () => {
      const { svc, availabilityRepo, service } = await buildService(30);
      const start = tomorrowAt(9, 0);

      await Promise.allSettled(
        Array.from({ length: 8 }, (_, i) => svc.claimSlot({ start, durationMinutes: service.durationMinutes }, `apt-${i}`)),
      );

      const winners = [...availabilityRepo._occupied.values()].filter((r) => r.start.getTime() === start.getTime());
      expect(winners).toHaveLength(1);
    });
  });

  describe("BR-AVAIL-6 — No auto-suggestion on claim failure: the same generic error regardless of WHY", () => {
    it("returns an identical generic SlotNotAvailableError for an appointment conflict and for a completely-outside-hours attempt", async () => {
      const { svc, service } = await buildService(30);
      const start = tomorrowAt(9, 0);
      await svc.claimSlot({ start, durationMinutes: service.durationMinutes }, "apt-existing");

      let conflictError: unknown;
      try {
        await svc.claimSlot({ start, durationMinutes: service.durationMinutes }, "apt-conflict");
      } catch (err) {
        conflictError = err;
      }

      let outsideHoursError: unknown;
      try {
        await svc.claimSlot({ start: tomorrowAt(3, 0), durationMinutes: service.durationMinutes }, "apt-outside-hours");
      } catch (err) {
        outsideHoursError = err;
      }

      expect(conflictError).toBeInstanceOf(SlotNotAvailableError);
      expect(outsideHoursError).toBeInstanceOf(SlotNotAvailableError);
      expect((conflictError as Error).message).toBe((outsideHoursError as Error).message);
      // No alternative-slot data of any kind is attached to the failure — BR-AVAIL-6 is
      // explicit that `availability` does not compute or return an alternative slot.
      expect(conflictError).not.toHaveProperty("suggestedSlot");
      expect(conflictError).not.toHaveProperty("alternativeSlot");
      expect(conflictError).not.toHaveProperty("alternatives");
    });
  });

  describe("BR-AVAIL-7 — Working hours: exactly one range per day, all 7 days required", () => {
    it("setWorkingHours accepts a full 7-day schedule and returns it", async () => {
      const { svc } = await buildService();
      const result = await svc.setWorkingHours(everydayOpenSchedule("08:00", "18:00"));
      expect(result.workingHours).toHaveLength(7);
      expect(result.workingHours.every((r) => r.isOpen && r.openTime === "08:00" && r.closeTime === "18:00")).toBe(true);
    });

    it("rejects a schedule with fewer than 7 entries", async () => {
      const { svc } = await buildService();
      const partial = everydayOpenSchedule().slice(0, 6);
      await expect(svc.setWorkingHours(partial)).rejects.toBeInstanceOf(AvailabilityValidationError);
    });

    it("rejects an open day missing openTime/closeTime", async () => {
      const { svc } = await buildService();
      const schedule = everydayOpenSchedule();
      schedule[0] = { ...schedule[0], openTime: null };
      await expect(svc.setWorkingHours(schedule)).rejects.toBeInstanceOf(AvailabilityValidationError);
    });
  });

  describe("BR-AVAIL-8 — Time off blocks whole calendar days only", () => {
    it("addTimeOff removes every slot on the marked day(s) but leaves adjacent days untouched", async () => {
      const { svc, service } = await buildService(30);
      const dayOff = tomorrowAt(0, 0);
      await svc.addTimeOff({ startDate: dayOff, endDate: dayOff, reason: "vacation" });

      const dayAfter = addDaysUTC(dayOff, 1);
      // End the requested range well into dayAfter (not just at its midnight boundary) so
      // dayAfter's own 09:00-17:00 slots aren't excluded by the range's upper bound too.
      const rangeEnd = addDaysUTC(dayOff, 2);
      const slots = await svc.getAvailableSlots({ start: dayOff, end: rangeEnd }, service.id);

      expect(slots.some((s) => sameUTCDay(s.start, dayOff))).toBe(false);
      expect(slots.some((s) => sameUTCDay(s.start, dayAfter))).toBe(true);
    });

    it("claimSlot rejects a slot whose date falls inside the time-off range", async () => {
      const { svc, service } = await buildService(30);
      const dayOff = tomorrowAt(0, 0);
      await svc.addTimeOff({ startDate: dayOff, endDate: dayOff });

      await expect(
        svc.claimSlot({ start: tomorrowAt(10, 0), durationMinutes: service.durationMinutes }, "apt-1"),
      ).rejects.toBeInstanceOf(SlotNotAvailableError);
    });
  });

  describe("BR-AVAIL-9 — Working-hours/time-off changes never auto-cancel, only flag affected appointments", () => {
    it("setWorkingHours flags an existing future appointment that no longer fits, without cancelling it", async () => {
      const { svc, availabilityRepo } = await buildService(30);
      const start = tomorrowAt(16, 0); // 16:00-16:30, fits the original 09:00-17:00 day
      await svc.claimSlot({ start, durationMinutes: 30 }, "apt-flagged");

      const result = await svc.setWorkingHours(everydayOpenSchedule("09:00", "16:00")); // shop now closes earlier

      expect(result.affectedAppointmentIds).toContain("apt-flagged");
      expect(availabilityRepo._occupied.has("apt-flagged")).toBe(true); // never cancelled
    });

    it("setWorkingHours does NOT flag an appointment that still fits the new hours", async () => {
      const { svc } = await buildService(30);
      const start = tomorrowAt(9, 0); // 09:00-09:30, still fits any reasonable morning schedule
      await svc.claimSlot({ start, durationMinutes: 30 }, "apt-unaffected");

      const result = await svc.setWorkingHours(everydayOpenSchedule("09:00", "16:00"));

      expect(result.affectedAppointmentIds).not.toContain("apt-unaffected");
    });

    it("addTimeOff flags an existing future appointment whose date now falls inside the new time-off range, without cancelling it", async () => {
      const { svc, availabilityRepo } = await buildService(30);
      const start = tomorrowAt(10, 0);
      await svc.claimSlot({ start, durationMinutes: 30 }, "apt-flagged-2");

      const dayOff = tomorrowAt(0, 0);
      const result = await svc.addTimeOff({ startDate: dayOff, endDate: dayOff });

      expect(result.affectedAppointmentIds).toContain("apt-flagged-2");
      expect(availabilityRepo._occupied.has("apt-flagged-2")).toBe(true); // never cancelled
    });
  });

  describe("BR-AVAIL-10 — Override conflict = appointment overlap only (forceClaimSlot)", () => {
    it("bypasses hours/time-off silently (no conflictFlag) but marks isOverride = true when it was actually needed", async () => {
      const { svc } = await buildService(30);
      const result = await svc.forceClaimSlot({ start: tomorrowAt(3, 0), durationMinutes: 30 }, "apt-override-1");
      expect(result.conflictFlag).toBe(false);
      expect(result.isOverride).toBe(true);
    });

    it("raises conflictFlag only when the requested range truly overlaps an already-booked appointment, and never throws", async () => {
      const { svc } = await buildService(30);
      const start = tomorrowAt(10, 0);
      await svc.claimSlot({ start, durationMinutes: 30 }, "apt-existing");

      const result = await svc.forceClaimSlot({ start, durationMinutes: 30 }, "apt-conflicting");

      expect(result.conflictFlag).toBe(true); // owner is warned, not blocked
    });

    it("isOverride is false when the override path wasn't actually needed (a normal claim would have succeeded too)", async () => {
      const { svc } = await buildService(30);
      const result = await svc.forceClaimSlot({ start: tomorrowAt(10, 0), durationMinutes: 30 }, "apt-not-really-override");
      expect(result.isOverride).toBe(false);
      expect(result.conflictFlag).toBe(false);
    });
  });

  describe("BR-AVAIL-11 — releaseSlot is unconditional", () => {
    it("resolves without error for a claimed appointmentId, an unknown one, and an override-claimed one", async () => {
      const { svc } = await buildService(30);
      await svc.claimSlot({ start: tomorrowAt(9, 0), durationMinutes: 30 }, "apt-normal");
      await svc.forceClaimSlot({ start: tomorrowAt(3, 0), durationMinutes: 30 }, "apt-override");

      await expect(svc.releaseSlot("apt-normal")).resolves.toBeUndefined();
      await expect(svc.releaseSlot("apt-override")).resolves.toBeUndefined();
      await expect(svc.releaseSlot("never-existed")).resolves.toBeUndefined();
    });
  });

  describe("Flow 1 — getAvailableSlots error paths", () => {
    it("throws ServiceNotFoundError for an unknown serviceId", async () => {
      const { svc } = await buildService();
      const now = new Date();
      await expect(svc.getAvailableSlots({ start: now, end: addDaysUTC(now, 1) }, "no-such-service")).rejects.toBeInstanceOf(
        ServiceNotFoundError,
      );
    });

    it("rejects an invalid date range", async () => {
      const { svc, service } = await buildService();
      await expect(
        svc.getAvailableSlots({ start: new Date("not-a-date"), end: new Date() }, service.id),
      ).rejects.toBeInstanceOf(AvailabilityValidationError);
    });
  });

  describe("isSlotAvailable — pre-check without side effects", () => {
    it("returns true for an open slot and does not occupy it", async () => {
      const { svc, availabilityRepo } = await buildService(30);
      const start = tomorrowAt(9, 0);
      await expect(svc.isSlotAvailable({ start, durationMinutes: 30 })).resolves.toBe(true);
      expect(availabilityRepo._occupied.size).toBe(0);
    });

    it("returns false once the slot has actually been claimed by someone else", async () => {
      const { svc } = await buildService(30);
      const start = tomorrowAt(9, 0);
      await svc.claimSlot({ start, durationMinutes: 30 }, "apt-1");
      await expect(svc.isSlotAvailable({ start, durationMinutes: 30 })).resolves.toBe(false);
    });

    it("rejects an invalid SlotRequest (non-positive duration)", async () => {
      const { svc } = await buildService();
      await expect(svc.isSlotAvailable({ start: tomorrowAt(9, 0), durationMinutes: 0 })).rejects.toBeInstanceOf(
        AvailabilityValidationError,
      );
    });
  });
});
