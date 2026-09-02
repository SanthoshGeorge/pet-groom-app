// Step 18 — real-Postgres integration tests for `createPrismaReportingRepository`
// (src/modules/reporting/prisma/repository.ts).
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
// SCOPE: `reporting` owns no table of its own — it only ever counts rows on the
// (booking-owned) `Appointment` table (this repository file's own header comment). Step
// 10's `tests/modules/reporting.test.ts` already covers BR-REPORT-1..4 against a fake, so
// this file is short: it proves the two `prisma.appointment.count` calls (BR-REPORT-2's
// every-status total, BR-REPORT-3's NoShow-only count) are scoped to the same half-open
// `[start, end)` range and actually run as real, independent aggregate queries against
// real data — not the fake's in-memory `.filter().length`.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaReportingRepository } from "@/modules/reporting/prisma/repository";
import { closeTestPrismaClient, getTestPrismaClient, resetDatabase } from "./test-helpers/prisma-client";
import { seedAppointment, seedGroomer, seedOwner } from "./test-helpers/seed";

const prisma = getTestPrismaClient();
const repo = createPrismaReportingRepository(prisma);

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

describe("countAppointmentsInRange", () => {
  it("BR-REPORT-2/3 — totalAppointments counts every status in range; noShowCount counts only NoShow in the same range", async () => {
    const range = { start: new Date("2026-10-10T00:00:00.000Z"), end: new Date("2026-10-17T00:00:00.000Z") };

    await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-11T09:00:00.000Z"),
      slotEnd: new Date("2026-10-11T09:30:00.000Z"),
      status: "Completed",
    });
    await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-12T09:00:00.000Z"),
      slotEnd: new Date("2026-10-12T09:30:00.000Z"),
      status: "NoShow",
    });
    await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-13T09:00:00.000Z"),
      slotEnd: new Date("2026-10-13T09:30:00.000Z"),
      status: "Cancelled", // still counted in totalAppointments (BR-REPORT-2 — every status)
    });
    await seedAppointment(prisma, {
      // outside the range — excluded from both counts
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-20T09:00:00.000Z"),
      slotEnd: new Date("2026-10-20T09:30:00.000Z"),
      status: "NoShow",
    });

    const result = await repo.countAppointmentsInRange(range);
    expect(result.totalAppointments).toBe(3);
    expect(result.noShowCount).toBe(1);
  });

  it("respects the half-open [start, end) boundary — a slotStart exactly at `end` is excluded", async () => {
    const range = { start: new Date("2026-10-10T00:00:00.000Z"), end: new Date("2026-10-11T00:00:00.000Z") };
    await seedAppointment(prisma, {
      ownerId,
      groomerId,
      slotStart: new Date("2026-10-11T00:00:00.000Z"), // == end
      slotEnd: new Date("2026-10-11T00:30:00.000Z"),
    });

    const result = await repo.countAppointmentsInRange(range);
    expect(result.totalAppointments).toBe(0);
    expect(result.noShowCount).toBe(0);
  });

  it("returns zero counts for a range with no appointments at all", async () => {
    const result = await repo.countAppointmentsInRange({
      start: new Date("2030-01-01T00:00:00.000Z"),
      end: new Date("2030-02-01T00:00:00.000Z"),
    });
    expect(result).toEqual({ totalAppointments: 0, noShowCount: 0 });
  });
});
