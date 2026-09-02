// Step 18 — real-Postgres integration tests for `createPrismaNotificationRepository`
// (src/modules/notification/prisma/repository.ts).
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
// SCOPE: Step 10's `tests/modules/notification.test.ts` already covers BR-NOTIF-1..7
// against a fake. This file covers what's NEW at the repository/DB layer:
// `findDueReminders`'s nested `include` (a single round trip pairing each due
// `ScheduledReminder` with its FULL `AppointmentWithLineItems`, per repository.ts's
// `DueReminder` contract) actually produces a correctly-shaped, correctly-mapped result
// against real relations, and `markAppointmentNotificationFailed`'s cross-module write
// onto the (booking-owned) `Appointment.notificationFailed` column.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaNotificationRepository } from "@/modules/notification/prisma/repository";
import { closeTestPrismaClient, getTestPrismaClient, resetDatabase } from "./test-helpers/prisma-client";
import { seedAppointment, seedGroomer, seedOwner, seedPet, seedService } from "./test-helpers/seed";

const prisma = getTestPrismaClient();
const repo = createPrismaNotificationRepository(prisma);

let appointmentId: string;

beforeEach(async () => {
  await resetDatabase(prisma);
  const groomer = await seedGroomer(prisma);
  const owner = await seedOwner(prisma);
  const pet = await seedPet(prisma, owner.id);
  const service = await seedService(prisma);
  const appointment = await seedAppointment(prisma, {
    ownerId: owner.id,
    groomerId: groomer.id,
    slotStart: new Date("2026-10-05T09:00:00.000Z"),
    slotEnd: new Date("2026-10-05T09:30:00.000Z"),
    lineItems: [{ petId: pet.id, serviceId: service.id, priceSnapshot: 40, durationSnapshotMinutes: 30 }],
  });
  appointmentId = appointment.id;
});

afterAll(async () => {
  await closeTestPrismaClient();
});

describe("createScheduledReminder / findPendingReminderByAppointmentId", () => {
  it("BR-NOTIF-1 — creates a reminder with status Pending, findable by appointmentId", async () => {
    const sendAt = new Date("2026-10-04T08:00:00.000Z");
    const created = await repo.createScheduledReminder({ appointmentId, sendAt });
    expect(created.status).toBe("Pending");
    expect(created.sendAt?.getTime()).toBe(sendAt.getTime());

    const found = await repo.findPendingReminderByAppointmentId(appointmentId);
    expect(found?.id).toBe(created.id);
  });

  it("returns null once the reminder is no longer Pending (already Sent or Cancelled)", async () => {
    const created = await repo.createScheduledReminder({ appointmentId, sendAt: new Date() });
    await repo.updateReminderStatus(created.id, "Sent");
    expect(await repo.findPendingReminderByAppointmentId(appointmentId)).toBeNull();
  });
});

describe("updateReminderStatus", () => {
  it("BR-NOTIF-6 — flips status to Cancelled (reschedule path), no longer returned as Pending", async () => {
    const created = await repo.createScheduledReminder({ appointmentId, sendAt: new Date() });
    await repo.updateReminderStatus(created.id, "Cancelled");
    expect(await repo.findPendingReminderByAppointmentId(appointmentId)).toBeNull();
  });
});

describe("findDueReminders", () => {
  it("Flow 3 — returns only Pending reminders whose sendAt <= now, each paired with its full AppointmentWithLineItems in one round trip", async () => {
    const due = await repo.createScheduledReminder({ appointmentId, sendAt: new Date("2020-01-01T00:00:00.000Z") });
    await repo.createScheduledReminder({ appointmentId, sendAt: new Date("2099-01-01T00:00:00.000Z") }); // not due yet
    const alreadySent = await repo.createScheduledReminder({ appointmentId, sendAt: new Date("2020-01-01T00:00:00.000Z") });
    await repo.updateReminderStatus(alreadySent.id, "Sent"); // due, but not Pending -> excluded

    const results = await repo.findDueReminders(new Date());
    expect(results).toHaveLength(1);
    expect(results[0].reminder.id).toBe(due.id);
    expect(results[0].appointment.id).toBe(appointmentId);
    expect(results[0].appointment.lineItems).toHaveLength(1);
    expect(results[0].appointment.lineItems[0].priceSnapshot).toBe(40);
  });
});

describe("markAppointmentNotificationFailed", () => {
  it("BR-NOTIF-4 — sets Appointment.notificationFailed to true, idempotently (a second call does not throw or change the outcome)", async () => {
    await repo.markAppointmentNotificationFailed(appointmentId);
    await repo.markAppointmentNotificationFailed(appointmentId);
    const row = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    expect(row?.notificationFailed).toBe(true);
  });
});
