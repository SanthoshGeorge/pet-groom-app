// Step 18 — real-Postgres integration tests for `createPrismaBookingRepository`
// (src/modules/booking/prisma/repository.ts).
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
// SCOPE — why this is the most important file in this directory:
//
// `booking`'s `createAppointment` is where BR-AVAIL-5's real, DB-enforced atomicity
// guarantee actually lives — NOT `availability.claimSlot`. Both
// `src/modules/availability/prisma/repository.ts` and this module's own
// `src/modules/booking/prisma/repository.ts` document this architectural finding at
// length in their file-level header comments (read those first): there is no `SlotClaim`
// table, `Appointment` is the only table carrying the real `@@unique([groomerId,
// slotStart])` constraint (schema.prisma), and `availability`'s `claimSlot` runs BEFORE a
// full, insertable `Appointment` row exists — so it can only do a best-effort pre-check
// read, not the literal insert-and-catch-P2002 pattern nfr-design-patterns.md specifies.
// That pattern is implemented here instead, in `createAppointment`, wrapped in a
// `prisma.$transaction` alongside the `AppointmentLineItem` price/duration-snapshot
// writes (BR-CAT-4). Step 10's `tests/modules/availability.test.ts` already has its own
// BR-AVAIL-5 concurrent-request test, but that one runs against the in-memory fake
// repository (`tests/fakes/availability.fake.ts`) — it proves the SERVICE layer reacts
// correctly to a claim failure, not that a real Postgres instance actually serializes the
// race. THIS file's "BR-AVAIL-5" describe block below is the one that does that — it
// fires concurrent `createAppointment` calls directly (bypassing `availability` and
// `booking/service.ts` entirely, per the Code Generation task's explicit instruction),
// which is the only way to exercise the real database constraint this rule ultimately
// depends on.
//
// Everything else in this file covers the rest of `BookingRepository`'s methods at a
// level of thoroughness matching `booking`'s complexity (the most business-rule-dense of
// the 7 modules) — basic CRUD, row mapping (enum casts, `Decimal` -> `number`), and the
// `updateStatus`/`updateService`-style `undefined`-means-unchanged Prisma semantics
// `code/api-layer-summary.md` flagged as unverified until this phase.

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaBookingRepository } from "@/modules/booking/prisma/repository";
import { BookingReferenceCollisionError, SlotNotAvailableError } from "@/modules/booking/errors";
import type { CreateAppointmentInput } from "@/modules/booking/repository";
import { closeTestPrismaClient, getTestPrismaClient, resetDatabase } from "./test-helpers/prisma-client";
import { seedGroomer, seedOwner, seedPet, seedService } from "./test-helpers/seed";

const prisma = getTestPrismaClient();
const repo = createPrismaBookingRepository(prisma);

let groomerId: string;
let ownerId: string;
let petId: string;
let serviceId: string;

beforeEach(async () => {
  await resetDatabase(prisma);
  const groomer = await seedGroomer(prisma);
  const owner = await seedOwner(prisma);
  const pet = await seedPet(prisma, owner.id);
  const service = await seedService(prisma, { price: 40, durationMinutes: 30 });
  groomerId = groomer.id;
  ownerId = owner.id;
  petId = pet.id;
  serviceId = service.id;
});

afterAll(async () => {
  await closeTestPrismaClient();
});

function randomBookingReference(): string {
  return `HTG-${Math.floor(1000 + Math.random() * 9000)}`;
}

function buildInput(overrides: Partial<CreateAppointmentInput> = {}): CreateAppointmentInput {
  const slotStart = overrides.slotStart ?? new Date("2026-10-05T09:00:00.000Z");
  const slotEnd = overrides.slotEnd ?? new Date(slotStart.getTime() + 30 * 60_000);
  return {
    id: overrides.id ?? randomUUID(),
    bookingReference: overrides.bookingReference ?? randomBookingReference(),
    ownerId: overrides.ownerId ?? ownerId,
    groomerId: overrides.groomerId ?? groomerId,
    slotStart,
    slotEnd,
    status: "Booked",
    createdBy: overrides.createdBy ?? "guest",
    isOverride: overrides.isOverride ?? false,
    hasConflict: overrides.hasConflict ?? false,
    visitNotes: overrides.visitNotes ?? null,
    lineItems: overrides.lineItems ?? [{ petId, serviceId, priceSnapshot: 40, durationSnapshotMinutes: 30 }],
  };
}

describe("createAppointment — basic CRUD / row mapping correctness", () => {
  it("persists the Appointment and its line items, readable back via findAppointmentById", async () => {
    const input = buildInput({ visitNotes: "First-time visit" });
    const created = await repo.createAppointment(input);

    expect(created.id).toBe(input.id);
    expect(created.bookingReference).toBe(input.bookingReference);
    expect(created.status).toBe("Booked");
    expect(created.isOverride).toBe(false);
    expect(created.hasConflict).toBe(false);
    expect(created.flaggedForReview).toBe(false); // schema default
    expect(created.notificationFailed).toBe(false); // schema default
    expect(created.visitNotes).toBe("First-time visit");
    expect(created.cancelledAt).toBeNull();
    expect(created.cancelledBy).toBeNull();
    expect(created.lineItems).toHaveLength(1);

    const found = await repo.findAppointmentById(created.id);
    expect(found).not.toBeNull();
    expect(found?.bookingReference).toBe(input.bookingReference);
    expect(found?.lineItems).toHaveLength(1);
  });

  it("findAppointmentByReference finds the same row by bookingReference", async () => {
    const input = buildInput();
    const created = await repo.createAppointment(input);
    const found = await repo.findAppointmentByReference(input.bookingReference);
    expect(found?.id).toBe(created.id);
  });

  it("findAppointmentById / findAppointmentByReference return null for an unknown id/reference", async () => {
    expect(await repo.findAppointmentById("nonexistent-id")).toBeNull();
    expect(await repo.findAppointmentByReference("HTG-0000")).toBeNull();
  });
});

describe("createAppointment — price/duration snapshot persisted atomically with the Appointment row (BR-CAT-4)", () => {
  it("persists the exact snapshot values from the input, independent of the live Service row", async () => {
    const input = buildInput({
      lineItems: [{ petId, serviceId, priceSnapshot: 99.99, durationSnapshotMinutes: 45 }],
    });
    const created = await repo.createAppointment(input);
    expect(created.lineItems[0].priceSnapshot).toBe(99.99);
    expect(created.lineItems[0].durationSnapshotMinutes).toBe(45);

    // Change the live Service afterward — the already-booked snapshot must not move
    // (BR-CAT-3/BR-CAT-4: only the live row changes, already-booked appointments are
    // unaffected).
    await prisma.service.update({ where: { id: serviceId }, data: { price: 500, durationMinutes: 10 } });

    const reread = await repo.findAppointmentById(created.id);
    expect(reread?.lineItems[0].priceSnapshot).toBe(99.99);
    expect(reread?.lineItems[0].durationSnapshotMinutes).toBe(45);
  });

  it("a multi-pet appointment's line items are all persisted together (all-or-nothing within the transaction)", async () => {
    const secondPet = await seedPet(prisma, ownerId, { name: "Whiskers" });
    const input = buildInput({
      lineItems: [
        { petId, serviceId, priceSnapshot: 40, durationSnapshotMinutes: 30 },
        { petId: secondPet.id, serviceId, priceSnapshot: 40, durationSnapshotMinutes: 30 },
      ],
    });
    const created = await repo.createAppointment(input);
    expect(created.lineItems).toHaveLength(2);

    const reread = await repo.findAppointmentById(created.id);
    expect(reread?.lineItems).toHaveLength(2);
  });
});

describe("BR-AVAIL-5 — Slot claims must be atomic, enforced by the REAL database constraint (concurrent-request test)", () => {
  it("exactly one of many concurrent createAppointment calls for the SAME (groomerId, slotStart) succeeds; every other call gets SlotNotAvailableError", async () => {
    const slotStart = new Date("2026-10-06T09:00:00.000Z");
    const slotEnd = new Date(slotStart.getTime() + 30 * 60_000);
    const callerCount = 12;

    // Distinct id + bookingReference per caller — isolates the (groomerId, slotStart)
    // race this test targets from BR-BOOK-8's own, unrelated bookingReference-collision
    // path (that path is covered separately below).
    const inputs = Array.from({ length: callerCount }, (_, i) =>
      buildInput({
        id: randomUUID(),
        bookingReference: `HTG-${1000 + i}`,
        slotStart,
        slotEnd,
      }),
    );

    const results = await Promise.allSettled(inputs.map((input) => repo.createAppointment(input)));

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(callerCount - 1);
    for (const r of rejected) {
      // The real Postgres `@@unique([groomerId, slotStart])` constraint (schema.prisma)
      // is what actually serializes this race — Postgres itself, not application code —
      // and `translateCreateAppointmentError` (booking/prisma/repository.ts) turns each
      // loser's real P2002 into exactly this error class, matching
      // `AvailabilityRepository.claimSlot`'s own documented contract (errors.ts) one
      // level up. This assertion is the one Step 18 exists to make: proving the
      // guarantee holds against a real database, not a mocked one.
      expect(r.reason).toBeInstanceOf(SlotNotAvailableError);
    }

    // The guarantee isn't just "one promise resolved" — confirm the database itself only
    // ever ended up holding one row for this exact slot.
    const persisted = await prisma.appointment.findMany({ where: { groomerId, slotStart } });
    expect(persisted).toHaveLength(1);
  });

  it("two concurrent createAppointment calls for DIFFERENT groomers at the same slotStart both succeed (the constraint is scoped per-groomer, not by slotStart alone)", async () => {
    const otherGroomer = await seedGroomer(prisma, { name: "Second Groomer" });
    const slotStart = new Date("2026-10-06T10:00:00.000Z");
    const slotEnd = new Date(slotStart.getTime() + 30 * 60_000);

    const [a, b] = await Promise.all([
      repo.createAppointment(buildInput({ id: randomUUID(), bookingReference: "HTG-2001", groomerId, slotStart, slotEnd })),
      repo.createAppointment(
        buildInput({ id: randomUUID(), bookingReference: "HTG-2002", groomerId: otherGroomer.id, slotStart, slotEnd }),
      ),
    ]);

    expect(a.id).not.toBe(b.id);
    expect(a.slotStart.getTime()).toBe(b.slotStart.getTime());
  });
});

describe("BR-BOOK-8 — bookingReference collision translated to BookingReferenceCollisionError, distinct from a slot collision", () => {
  it("throws BookingReferenceCollisionError (not SlotNotAvailableError) when the SAME bookingReference is reused for a DIFFERENT slot", async () => {
    const first = buildInput({
      id: randomUUID(),
      bookingReference: "HTG-7777",
      slotStart: new Date("2026-10-07T09:00:00.000Z"),
    });
    await repo.createAppointment(first);

    const second = buildInput({
      id: randomUUID(),
      bookingReference: "HTG-7777", // same reference
      slotStart: new Date("2026-10-07T11:00:00.000Z"), // different slot — not a (groomerId, slotStart) collision
    });

    await expect(repo.createAppointment(second)).rejects.toBeInstanceOf(BookingReferenceCollisionError);
  });
});

describe("findDefaultGroomer", () => {
  it("returns the earliest-created ACTIVE groomer when several exist (FR-2's exactly-one-groomer assumption, defensively ordered)", async () => {
    const later = await seedGroomer(prisma, { name: "Later Groomer" });
    const result = await repo.findDefaultGroomer();
    expect(result?.id).toBe(groomerId); // seeded first, in beforeEach
    expect(result?.id).not.toBe(later.id);
  });

  it("returns null when no active groomer exists", async () => {
    await prisma.groomer.updateMany({ data: { active: false } });
    expect(await repo.findDefaultGroomer()).toBeNull();
  });
});

describe("updateStatus", () => {
  it("BR-BOOK-6 — cancelling sets status/cancelledAt/cancelledBy together", async () => {
    const created = await repo.createAppointment(buildInput());
    const cancelledAt = new Date("2026-10-05T08:00:00.000Z");
    const updated = await repo.updateStatus(created.id, { status: "Cancelled", cancelledAt, cancelledBy: "account" });
    expect(updated.status).toBe("Cancelled");
    expect(updated.cancelledAt?.getTime()).toBe(cancelledAt.getTime());
    expect(updated.cancelledBy).toBe("account");
  });

  it("BR-BOOK-2b — a status-only update (markNoShow's shape) leaves cancelledAt/cancelledBy untouched — undefined means 'leave alone', matching Prisma's real update semantics", async () => {
    const created = await repo.createAppointment(buildInput());
    const updated = await repo.updateStatus(created.id, { status: "NoShow" });
    expect(updated.status).toBe("NoShow");
    expect(updated.cancelledAt).toBeNull();
    expect(updated.cancelledBy).toBeNull();
  });
});

describe("updateSlot", () => {
  it("BR-BOOK-3 — reschedule moves slotStart/slotEnd, keeps the same id and bookingReference", async () => {
    const created = await repo.createAppointment(buildInput());
    const newStart = new Date("2026-10-08T13:00:00.000Z");
    const newEnd = new Date(newStart.getTime() + 30 * 60_000);
    const updated = await repo.updateSlot(created.id, { slotStart: newStart, slotEnd: newEnd });
    expect(updated.id).toBe(created.id);
    expect(updated.bookingReference).toBe(created.bookingReference);
    expect(updated.slotStart.getTime()).toBe(newStart.getTime());
    expect(updated.slotEnd.getTime()).toBe(newEnd.getTime());
  });
});

describe("updateVisitNotes", () => {
  it("BR-BOOK-7 — sets and clears visitNotes independently of any pet's permanent notes", async () => {
    const created = await repo.createAppointment(buildInput({ visitNotes: "Be gentle, anxious dog" }));
    expect(created.visitNotes).toBe("Be gentle, anxious dog");

    const cleared = await repo.updateVisitNotes(created.id, null);
    expect(cleared.visitNotes).toBeNull();

    const setAgain = await repo.updateVisitNotes(created.id, "Loves belly rubs");
    expect(setAgain.visitNotes).toBe("Loves belly rubs");
  });
});

describe("listByOwner", () => {
  it("RC-3 — returns every appointment for the owner (any status), most-recent slotStart first, excluding other owners' appointments", async () => {
    const earlier = await repo.createAppointment(
      buildInput({ id: randomUUID(), bookingReference: "HTG-3001", slotStart: new Date("2026-10-01T09:00:00.000Z") }),
    );
    const later = await repo.createAppointment(
      buildInput({ id: randomUUID(), bookingReference: "HTG-3002", slotStart: new Date("2026-10-09T09:00:00.000Z") }),
    );
    const otherOwner = await seedOwner(prisma, { email: "someone-else@example.com" });
    await repo.createAppointment(
      buildInput({
        id: randomUUID(),
        bookingReference: "HTG-3003",
        ownerId: otherOwner.id,
        slotStart: new Date("2026-10-05T09:00:00.000Z"),
      }),
    );

    const list = await repo.listByOwner(ownerId);
    expect(list.map((a) => a.id)).toEqual([later.id, earlier.id]); // descending
  });
});

describe("listByDateRange", () => {
  it("SO-1 — returns appointments (any owner) whose slotStart falls in the half-open [start, end) range, ascending", async () => {
    const inRange = await repo.createAppointment(
      buildInput({ id: randomUUID(), bookingReference: "HTG-4001", slotStart: new Date("2026-10-10T09:00:00.000Z") }),
    );
    await repo.createAppointment(
      // exactly at `end` — must be EXCLUDED (half-open)
      buildInput({ id: randomUUID(), bookingReference: "HTG-4002", slotStart: new Date("2026-10-11T00:00:00.000Z") }),
    );
    await repo.createAppointment(
      // just before `start` — must be excluded
      buildInput({ id: randomUUID(), bookingReference: "HTG-4003", slotStart: new Date("2026-10-09T23:59:00.000Z") }),
    );

    const results = await repo.listByDateRange({
      start: new Date("2026-10-10T00:00:00.000Z"),
      end: new Date("2026-10-11T00:00:00.000Z"),
    });
    expect(results.map((a) => a.id)).toEqual([inRange.id]);
  });
});

describe("setFlaggedForReview", () => {
  it("BR-AVAIL-9 — sets flaggedForReview on exactly the given ids, leaving others untouched; a no-op for an empty array", async () => {
    const a = await repo.createAppointment(buildInput({ id: randomUUID(), bookingReference: "HTG-5001" }));
    const b = await repo.createAppointment(
      buildInput({ id: randomUUID(), bookingReference: "HTG-5002", slotStart: new Date("2026-10-12T09:00:00.000Z") }),
    );

    await repo.setFlaggedForReview([a.id], true);
    expect((await repo.findAppointmentById(a.id))?.flaggedForReview).toBe(true);
    expect((await repo.findAppointmentById(b.id))?.flaggedForReview).toBe(false);

    await expect(repo.setFlaggedForReview([], true)).resolves.toBeUndefined(); // documented no-op
  });
});
