// Step 18 — real-Postgres integration tests for `createPrismaAvailabilityRepository`
// (src/modules/availability/prisma/repository.ts).
//
// ============================================================================
// REQUIRES a generated Prisma Client + a real DATABASE_URL — see
// tests/integration/repositories/test-helpers/prisma-client.ts's header comment for the
// full explanation (this container cannot run `npx prisma generate`) and the exact run
// command. This file is excluded from `npx vitest run` (vitest.config.mts), `npx tsc
// --noEmit` (tsconfig.json), and `npx eslint .` (eslint.config.mjs) for that reason —
// see each config's own comment next to its exclusion entry.
// ============================================================================
//
// SCOPE: `claimSlot`/`forceClaimSlot` here are deliberately NOT where BR-AVAIL-5's real
// atomicity guarantee is proven — read this module's own `prisma/repository.ts`
// file-level architectural note (and `booking/prisma/repository.ts`'s matching one) for
// why: there is no `SlotClaim` table, so `claimSlot` is a best-effort, late re-check read
// against the live `Appointment` table, not an insert-and-catch. The REAL guarantee is
// exercised in `booking.repository.test.ts`'s "BR-AVAIL-5" describe block instead, which
// drives concurrent calls through `booking`'s `createAppointment` — the one place a full,
// insertable `Appointment` row actually exists. This file instead proves `claimSlot`/
// `forceClaimSlot` are faithful to their OWN documented contract (repository.ts,
// errors.ts) given that architecture, plus the rest of this module's CRUD (working
// hours, time off, occupied-range queries) — including the `@db.Time` <-> `"HH:mm"` and
// `@db.Date` conversions that only a real Postgres column can actually verify.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaAvailabilityRepository } from "@/modules/availability/prisma/repository";
import { SlotConstraintViolationError } from "@/modules/availability/errors";
import type { WorkingHoursRuleInput } from "@/modules/availability/types";
import { closeTestPrismaClient, getTestPrismaClient, resetDatabase } from "./test-helpers/prisma-client";
import { seedAppointment, seedGroomer, seedOwner } from "./test-helpers/seed";

const prisma = getTestPrismaClient();
const repo = createPrismaAvailabilityRepository(prisma);

// availability's own repository never touches Pet/Service — only Groomer (for
// resolveActiveGroomerId) and Appointment (via seedAppointment) are needed as fixtures.
let groomerId: string;
let ownerId: string;

beforeEach(async () => {
  await resetDatabase(prisma);
  const groomer = await seedGroomer(prisma);
  const owner = await seedOwner(prisma);
  groomerId = groomer.id;
  ownerId = owner.id;
});

afterAll(async () => {
  await closeTestPrismaClient();
});

const FULL_WEEK: WorkingHoursRuleInput[] = [
  { dayOfWeek: "Mon", isOpen: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: "Tue", isOpen: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: "Wed", isOpen: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: "Thu", isOpen: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: "Fri", isOpen: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: "Sat", isOpen: true, openTime: "10:00", closeTime: "14:00" },
  { dayOfWeek: "Sun", isOpen: false, openTime: null, closeTime: null },
];

describe("replaceWorkingHours / listWorkingHours", () => {
  it("BR-AVAIL-7 — wholesale replace produces exactly 7 rows, sorted Mon..Sun regardless of insert order", async () => {
    const result = await repo.replaceWorkingHours(FULL_WEEK);
    expect(result.map((r) => r.dayOfWeek)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

    const relisted = await repo.listWorkingHours();
    expect(relisted).toHaveLength(7);
    expect(relisted.map((r) => r.dayOfWeek)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("round-trips openTime/closeTime through the @db.Time column correctly (HH:mm in, HH:mm out)", async () => {
    await repo.replaceWorkingHours(FULL_WEEK);
    const monday = (await repo.listWorkingHours()).find((r) => r.dayOfWeek === "Mon");
    expect(monday?.isOpen).toBe(true);
    expect(monday?.openTime).toBe("09:00");
    expect(monday?.closeTime).toBe("17:00");

    const saturday = (await repo.listWorkingHours()).find((r) => r.dayOfWeek === "Sat");
    expect(saturday?.openTime).toBe("10:00");
    expect(saturday?.closeTime).toBe("14:00");
  });

  it("a closed day (isOpen: false) always reads back null openTime/closeTime, even if the input carried stray values", async () => {
    const weekWithStrayTimesOnClosedDay = FULL_WEEK.map((r) =>
      r.dayOfWeek === "Sun" ? { ...r, openTime: "09:00", closeTime: "17:00" } : r,
    );
    await repo.replaceWorkingHours(weekWithStrayTimesOnClosedDay);
    const sunday = (await repo.listWorkingHours()).find((r) => r.dayOfWeek === "Sun");
    expect(sunday?.isOpen).toBe(false);
    expect(sunday?.openTime).toBeNull();
    expect(sunday?.closeTime).toBeNull();
  });

  it("calling replaceWorkingHours a second time UPSERTS in place — still exactly 7 rows, not 14", async () => {
    await repo.replaceWorkingHours(FULL_WEEK);
    const changedWeek = FULL_WEEK.map((r) => (r.dayOfWeek === "Mon" ? { ...r, openTime: "08:00" } : r));
    const result = await repo.replaceWorkingHours(changedWeek);

    expect(result).toHaveLength(7);
    const allRows = await prisma.workingHoursRule.findMany();
    expect(allRows).toHaveLength(7);
    expect(result.find((r) => r.dayOfWeek === "Mon")?.openTime).toBe("08:00");
  });
});

describe("listTimeOff / createTimeOff", () => {
  it("BR-AVAIL-8 — creates a whole-day(s) block and lists it back, ordered by startDate ascending", async () => {
    const later = await repo.createTimeOff({
      startDate: new Date("2026-12-25T00:00:00.000Z"),
      endDate: new Date("2026-12-26T00:00:00.000Z"),
      reason: "Holiday closure",
    });
    const earlier = await repo.createTimeOff({
      startDate: new Date("2026-11-01T00:00:00.000Z"),
      endDate: new Date("2026-11-01T00:00:00.000Z"),
    });

    const list = await repo.listTimeOff();
    expect(list.map((t) => t.id)).toEqual([earlier.id, later.id]);
    expect(list[1].reason).toBe("Holiday closure");
    expect(list[0].reason).toBeNull(); // optional field omitted -> null, not undefined
  });
});

describe("listOccupiedRanges", () => {
  it("BR-AVAIL-11 — returns only Booked appointments overlapping the window; Cancelled/NoShow/Completed and out-of-window rows are excluded", async () => {
    const windowStart = new Date("2026-10-10T00:00:00.000Z");
    const windowEnd = new Date("2026-10-11T00:00:00.000Z");

    const booked = await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-10T09:00:00.000Z"),
      slotEnd: new Date("2026-10-10T09:30:00.000Z"),
      status: "Booked",
    });
    await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-10T10:00:00.000Z"),
      slotEnd: new Date("2026-10-10T10:30:00.000Z"),
      status: "Cancelled",
    });
    await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-10T11:00:00.000Z"),
      slotEnd: new Date("2026-10-10T11:30:00.000Z"),
      status: "NoShow",
    });
    await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-12T09:00:00.000Z"), // outside the window
      slotEnd: new Date("2026-10-12T09:30:00.000Z"),
      status: "Booked",
    });

    const ranges = await repo.listOccupiedRanges(windowStart, windowEnd);
    expect(ranges.map((r) => r.appointmentId)).toEqual([booked.id]);
  });

  it("excludeAppointmentId omits that appointment's own row (reschedule's self-exclusion)", async () => {
    const windowStart = new Date("2026-10-10T00:00:00.000Z");
    const windowEnd = new Date("2026-10-11T00:00:00.000Z");
    const beingRescheduled = await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-10T09:00:00.000Z"),
      slotEnd: new Date("2026-10-10T09:30:00.000Z"),
      status: "Booked",
    });

    const ranges = await repo.listOccupiedRanges(windowStart, windowEnd, beingRescheduled.id);
    expect(ranges).toHaveLength(0);
  });
});

describe("listFutureOccupiedRanges", () => {
  it("BR-AVAIL-9 — returns every future Booked appointment from fromDate onward, with no upper bound", async () => {
    const fromDate = new Date("2026-10-10T00:00:00.000Z");
    const nearFuture = await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-10T09:00:00.000Z"),
      slotEnd: new Date("2026-10-10T09:30:00.000Z"),
    });
    const farFuture = await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2027-06-01T09:00:00.000Z"),
      slotEnd: new Date("2027-06-01T09:30:00.000Z"),
    });
    await seedAppointment(prisma, {
      // ends before fromDate -> excluded
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-09T09:00:00.000Z"),
      slotEnd: new Date("2026-10-09T09:30:00.000Z"),
    });

    const ranges = await repo.listFutureOccupiedRanges(fromDate);
    expect(ranges.map((r) => r.appointmentId).sort()).toEqual([farFuture.id, nearFuture.id].sort());
  });
});

describe("claimSlot — best-effort late re-check against the live Appointment table", () => {
  it("resolves without throwing when the (groomerId, slotStart) is genuinely free", async () => {
    await expect(
      repo.claimSlot({ appointmentId: "apt-new", start: new Date("2026-10-15T09:00:00.000Z"), end: new Date("2026-10-15T09:30:00.000Z") }),
    ).resolves.toBeUndefined();
  });

  it("throws SlotConstraintViolationError when another appointment already occupies the exact same (groomerId, slotStart)", async () => {
    const slotStart = new Date("2026-10-15T09:00:00.000Z");
    await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart,
      slotEnd: new Date("2026-10-15T09:30:00.000Z"),
    });

    await expect(
      repo.claimSlot({ appointmentId: "apt-new", start: slotStart, end: new Date("2026-10-15T09:30:00.000Z") }),
    ).rejects.toBeInstanceOf(SlotConstraintViolationError);
  });

  it("a Cancelled row at the same slot STILL counts as a conflict — this check is not scoped by status (matches the real unique index's own scope)", async () => {
    const slotStart = new Date("2026-10-15T09:00:00.000Z");
    await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart,
      slotEnd: new Date("2026-10-15T09:30:00.000Z"),
      status: "Cancelled",
    });

    await expect(
      repo.claimSlot({ appointmentId: "apt-new", start: slotStart, end: new Date("2026-10-15T09:30:00.000Z") }),
    ).rejects.toBeInstanceOf(SlotConstraintViolationError);
  });

  it("excludes the appointment's OWN row via appointmentId (reschedule onto its own unchanged slot doesn't self-conflict)", async () => {
    const slotStart = new Date("2026-10-15T09:00:00.000Z");
    const existing = await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart,
      slotEnd: new Date("2026-10-15T09:30:00.000Z"),
    });

    await expect(
      repo.claimSlot({ appointmentId: existing.id, start: slotStart, end: new Date("2026-10-15T09:30:00.000Z") }),
    ).resolves.toBeUndefined();
  });

  it("resolves without throwing when no active groomer is configured at all (nothing could have claimed the slot either)", async () => {
    await prisma.groomer.updateMany({ data: { active: false } });
    await expect(
      repo.claimSlot({ appointmentId: "apt-new", start: new Date("2026-10-15T09:00:00.000Z"), end: new Date("2026-10-15T09:30:00.000Z") }),
    ).resolves.toBeUndefined();
  });
});

describe("forceClaimSlot — SO-3 override path", () => {
  it("is a documented no-op: resolves without throwing and persists nothing, even when the slot already conflicts", async () => {
    const slotStart = new Date("2026-10-16T09:00:00.000Z");
    await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart,
      slotEnd: new Date("2026-10-16T09:30:00.000Z"),
    });

    const before = await prisma.appointment.count();
    await expect(
      repo.forceClaimSlot({ appointmentId: "apt-override", start: slotStart, end: new Date("2026-10-16T09:30:00.000Z") }),
    ).resolves.toBeUndefined();
    const after = await prisma.appointment.count();
    expect(after).toBe(before); // nothing written — booking's own repository persists the eventual row
  });
});
