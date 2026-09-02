// Shared fixture-seeding helpers for Step 18's real-Postgres repository integration
// tests (tests/integration/repositories/**) — same Prisma-generation / DATABASE_URL
// prerequisites as ./prisma-client.ts; see that file's header comment for the full
// explanation and how to actually run these tests once unblocked.
//
// Every helper below calls `prisma.<model>.create` DIRECTLY, never through a repository
// under test — deliberately: a test's fixture setup must not depend on the correctness
// of the very repository method that same test is verifying. Only real
// business-rule-relevant defaults are baked in (e.g. `Groomer.active: true`, per FR-2's
// "exactly one active groomer" assumption every Prisma repository in this codebase
// already makes — see e.g. `booking/prisma/repository.ts`'s `findDefaultGroomer`).

import type { PrismaClient } from "@prisma/client";

export async function seedGroomer(prisma: PrismaClient, overrides: { name?: string; active?: boolean } = {}) {
  return prisma.groomer.create({
    data: {
      name: overrides.name ?? "Test Groomer",
      active: overrides.active ?? true,
    },
  });
}

export async function seedService(
  prisma: PrismaClient,
  overrides: { name?: string; price?: number; durationMinutes?: number; active?: boolean } = {},
) {
  return prisma.service.create({
    data: {
      name: overrides.name ?? "Bath",
      price: overrides.price ?? 30,
      durationMinutes: overrides.durationMinutes ?? 30,
      active: overrides.active ?? true,
    },
  });
}

export async function seedOwner(
  prisma: PrismaClient,
  overrides: { name?: string; phone?: string; email?: string } = {},
) {
  return prisma.owner.create({
    data: {
      name: overrides.name ?? "Jane Owner",
      phone: overrides.phone ?? "555-0100",
      // Owner.email is NOT unique in the schema (see customer/prisma/repository.ts's
      // mapping notes — findOwnerByEmail uses findFirst, not findUnique) but a random
      // default here still keeps unrelated tests from accidentally colliding when a test
      // itself cares about email uniqueness/lookup ordering.
      email: overrides.email ?? `owner-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    },
  });
}

export async function seedPet(
  prisma: PrismaClient,
  ownerId: string,
  overrides: { name?: string; breed?: string; size?: "Small" | "Medium" | "Large" | "XL" } = {},
) {
  return prisma.pet.create({
    data: {
      ownerId,
      name: overrides.name ?? "Rex",
      breed: overrides.breed ?? "Labrador",
      size: overrides.size ?? "Medium",
    },
  });
}

/**
 * Seeds a full, insertable `Appointment` row (optionally with `AppointmentLineItem`
 * children) directly — used by `availability`/`notification`/`reporting`'s integration
 * tests, which all read `Appointment` data `booking` owns but don't themselves exercise
 * `BookingRepository.createAppointment` (that's `booking.repository.test.ts`'s own job,
 * including the BR-AVAIL-5 concurrent-request test).
 */
export async function seedAppointment(
  prisma: PrismaClient,
  params: {
    id?: string;
    bookingReference?: string;
    ownerId: string;
    groomerId: string;
    slotStart: Date;
    slotEnd: Date;
    status?: "Booked" | "Completed" | "Cancelled" | "NoShow";
    createdBy?: "guest" | "account" | "owner";
    isOverride?: boolean;
    hasConflict?: boolean;
    lineItems?: { petId: string; serviceId: string; priceSnapshot: number; durationSnapshotMinutes: number }[];
  },
) {
  return prisma.appointment.create({
    data: {
      id: params.id,
      bookingReference: params.bookingReference ?? `HTG-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerId: params.ownerId,
      groomerId: params.groomerId,
      slotStart: params.slotStart,
      slotEnd: params.slotEnd,
      status: params.status ?? "Booked",
      createdBy: params.createdBy ?? "guest",
      isOverride: params.isOverride ?? false,
      hasConflict: params.hasConflict ?? false,
      lineItems: params.lineItems
        ? {
            create: params.lineItems.map((li) => ({
              petId: li.petId,
              serviceId: li.serviceId,
              priceSnapshot: li.priceSnapshot,
              durationSnapshotMinutes: li.durationSnapshotMinutes,
            })),
          }
        : undefined,
    },
    include: { lineItems: true },
  });
}
