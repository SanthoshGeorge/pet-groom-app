// Step 18 — real-Postgres integration tests for `createPrismaCustomerRepository`
// (src/modules/customer/prisma/repository.ts).
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
// SCOPE: Step 10's `tests/modules/customer.test.ts` already covers BR-CUST-1..7 against a
// fake. This file covers what's NEW at the repository/DB layer: `findOwnerByEmail`/
// `findOwnerByPhone`'s `findFirst`-not-`findUnique` behavior against genuinely
// non-unique columns (more than one Owner row CAN share an email/phone in the real
// schema — the fake never had to model that), `Pet.size`'s Prisma-enum round-trip, and
// `updateOwner`/`updatePet`'s partial-update (`undefined` = leave untouched) semantics
// against a real `update`.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaCustomerRepository } from "@/modules/customer/prisma/repository";
import { closeTestPrismaClient, getTestPrismaClient, resetDatabase } from "./test-helpers/prisma-client";

const prisma = getTestPrismaClient();
const repo = createPrismaCustomerRepository(prisma);

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await closeTestPrismaClient();
});

describe("createOwner / findOwnerById / findOwnerByEmail / findOwnerByPhone", () => {
  it("persists and finds an owner by id, email, and phone", async () => {
    const created = await repo.createOwner({ name: "Jane Doe", phone: "555-1000", email: "jane@example.com" });
    expect(created.authIdentityId).toBeNull();
    expect(created.address).toBeNull();
    expect(created.notes).toBeNull();

    expect((await repo.findOwnerById(created.id))?.id).toBe(created.id);
    expect((await repo.findOwnerByEmail("jane@example.com"))?.id).toBe(created.id);
    expect((await repo.findOwnerByPhone("555-1000"))?.id).toBe(created.id);
  });

  it("BR-CUST-1 — findOwnerByEmail/findOwnerByPhone use findFirst (exact match), deterministically picking the earliest-created row when more than one Owner shares the same email or phone", async () => {
    const first = await repo.createOwner({ name: "First Guest", phone: "555-2000", email: "shared@example.com" });
    await repo.createOwner({ name: "Second Guest (same contact info)", phone: "555-2000", email: "shared@example.com" });

    expect((await repo.findOwnerByEmail("shared@example.com"))?.id).toBe(first.id);
    expect((await repo.findOwnerByPhone("555-2000"))?.id).toBe(first.id);
  });

  it("findOwnerById/findOwnerByEmail/findOwnerByPhone return null when nothing matches", async () => {
    expect(await repo.findOwnerById("nonexistent-id")).toBeNull();
    expect(await repo.findOwnerByEmail("nobody@example.com")).toBeNull();
    expect(await repo.findOwnerByPhone("000-0000")).toBeNull();
  });
});

describe("updateOwner — real Prisma partial-update semantics", () => {
  it("leaves fields not present in the partial input untouched; an explicit null clears a nullable field", async () => {
    const created = await repo.createOwner({ name: "Original Name", phone: "555-3000", email: "orig@example.com" });
    await repo.updateOwner(created.id, { address: "123 Main St" });

    const afterAddressSet = await repo.updateOwner(created.id, { phone: "555-3001" });
    expect(afterAddressSet.phone).toBe("555-3001");
    expect(afterAddressSet.name).toBe("Original Name"); // untouched
    expect(afterAddressSet.address).toBe("123 Main St"); // untouched by the phone-only update

    const cleared = await repo.updateOwner(created.id, { address: null });
    expect(cleared.address).toBeNull();
  });
});

describe("linkOwnerToAuthIdentity", () => {
  it("BR-CUST-4 — sets Owner.authIdentityId, connecting a guest Owner to an account", async () => {
    const owner = await repo.createOwner({ name: "Guest Turned Account", phone: "555-4000", email: "guest@example.com" });
    const identity = await prisma.authIdentity.create({ data: { email: "guest@example.com", passwordHash: "h", role: "customer" } });

    const linked = await repo.linkOwnerToAuthIdentity(owner.id, identity.id);
    expect(linked.authIdentityId).toBe(identity.id);
  });
});

describe("createPet / findPetById / listPetsByOwner / updatePet", () => {
  it("persists all fields, size enum round-trips, and listPetsByOwner returns only that owner's pets ordered by createdAt ascending", async () => {
    const owner = await repo.createOwner({ name: "Multi-Pet Owner", phone: "555-5000", email: "multipet@example.com" });
    const otherOwner = await repo.createOwner({ name: "Other Owner", phone: "555-5001", email: "other@example.com" });

    const first = await repo.createPet({ ownerId: owner.id, name: "Rex", breed: "Labrador", size: "Large", age: 3 });
    const second = await repo.createPet({ ownerId: owner.id, name: "Mittens", breed: "Tabby Mix", size: "Small" });
    await repo.createPet({ ownerId: otherOwner.id, name: "Not This Owner's Pet", breed: "Poodle", size: "Medium" });

    expect(first.size).toBe("Large");
    expect(first.age).toBe(3);
    expect(second.age).toBeNull(); // optional field omitted -> null, not undefined

    const list = await repo.listPetsByOwner(owner.id);
    expect(list.map((p) => p.id)).toEqual([first.id, second.id]);

    expect((await repo.findPetById(first.id))?.name).toBe("Rex");
    expect(await repo.findPetById("nonexistent-id")).toBeNull();
  });

  it("updatePet leaves fields not present in the partial input untouched", async () => {
    const owner = await repo.createOwner({ name: "Owner", phone: "555-6000", email: "petowner@example.com" });
    const pet = await repo.createPet({
      ownerId: owner.id,
      name: "Buddy",
      breed: "Beagle",
      size: "Medium",
      temperamentNotes: "Friendly",
    });

    const updated = await repo.updatePet(pet.id, { allergyMedicalNotes: "Allergic to chicken" });
    expect(updated.allergyMedicalNotes).toBe("Allergic to chicken");
    expect(updated.name).toBe("Buddy"); // untouched
    expect(updated.temperamentNotes).toBe("Friendly"); // untouched
  });
});
