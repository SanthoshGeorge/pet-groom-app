// Unit tests for CustomerService (src/modules/customer) — Code Generation Step 10.
// Covers every numbered rule in business-rules.md's "Customer (CustomerService)"
// section (BR-CUST-1..7) plus Flow 1 (Guest/Owner Identity Resolution) and Flow 5
// (Add/Update Pet) from business-logic-model.md. Backed by an in-memory fake
// CustomerRepository (tests/fakes/customer.fake.ts) — no real database involved.

import { beforeEach, describe, expect, it } from "vitest";
import { createCustomerService, type CustomerService } from "@/modules/customer/service";
import { CustomerValidationError, OwnerNotFoundError, PetNotFoundError } from "@/modules/customer/errors";
import { createFakeCustomerRepository, type FakeCustomerRepository } from "../fakes/customer.fake";

describe("CustomerService", () => {
  let repository: FakeCustomerRepository;
  let service: CustomerService;

  beforeEach(() => {
    repository = createFakeCustomerRepository();
    service = createCustomerService(repository);
  });

  describe("BR-CUST-1 — Owner matching: email OR phone, first match wins", () => {
    it("reuses an existing Owner found by exact email match (Flow 1 step 1)", async () => {
      const existing = await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });

      const result = await service.createOrFindOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });

      expect(result.id).toBe(existing.id);
      expect(repository._owners.size).toBe(1); // no duplicate created
    });

    it("falls back to exact phone match when email does not match (Flow 1 step 2)", async () => {
      const existing = await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });

      const result = await service.createOrFindOwner({ name: "Jane Doe", phone: "555-0100", email: "new-email@example.com" });

      expect(result.id).toBe(existing.id);
      expect(repository._owners.size).toBe(1);
    });

    it("creates a new Owner when neither email nor phone match anything on file (Flow 1 step 3)", async () => {
      const result = await service.createOrFindOwner({ name: "New Person", phone: "555-9999", email: "new@example.com" });

      expect(result.id).toBeTruthy();
      expect(repository._owners.size).toBe(1);
      expect(result.name).toBe("New Person");
    });
  });

  describe("BR-CUST-2 — Matched-owner field updates are additive, not destructive", () => {
    it("updates only the fields the incoming booking actually provided a different value for", async () => {
      const existing = await repository.updateOwner(
        (await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" })).id,
        { address: "1 Main St", notes: "prefers mornings" },
      );

      // Matched by email; phone on this new booking is different -> phone should update,
      // but name (unchanged) and address/notes (not part of ContactInfo at all) must survive.
      const result = await service.createOrFindOwner({ name: "Jane Doe", phone: "555-0200", email: "jane@example.com" });

      expect(result.id).toBe(existing.id);
      expect(result.phone).toBe("555-0200");
      expect(result.name).toBe("Jane Doe");
      expect(result.address).toBe("1 Main St");
      expect(result.notes).toBe("prefers mornings");
    });

    it("does not call updateOwner at all when nothing actually differs (pure reuse)", async () => {
      const existing = await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });
      const originalCreatedAt = existing.createdAt;

      const result = await service.createOrFindOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });

      expect(result).toEqual({ ...existing, createdAt: originalCreatedAt });
    });
  });

  describe("BR-CUST-3 — Ambiguous match (email and phone point to different Owners): prefer email", () => {
    it("resolves to the email-matched Owner and leaves the phone-matched Owner untouched", async () => {
      const emailMatch = await repository.createOwner({ name: "Email Owner", phone: "555-1111", email: "shared@example.com" });
      const phoneMatch = await repository.createOwner({ name: "Phone Owner", phone: "555-2222", email: "other@example.com" });

      // Incoming contact's email matches emailMatch, but its phone matches phoneMatch.
      const result = await service.createOrFindOwner({ name: "Someone", phone: "555-2222", email: "shared@example.com" });

      expect(result.id).toBe(emailMatch.id);
      // BR-CUST-2 additive update still applies to the winning (email) match: name/phone differ.
      expect(result.name).toBe("Someone");
      expect(result.phone).toBe("555-2222");
      // The phone-matched Owner (never selected) must be completely unmodified.
      const untouched = await repository.findOwnerById(phoneMatch.id);
      expect(untouched).toEqual(phoneMatch);
    });
  });

  describe("BR-CUST-4 — Account linking (linkAccount)", () => {
    it("sets Owner.authIdentityId, connecting the guest record to an account", async () => {
      const owner = await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });
      expect(owner.authIdentityId).toBeNull();

      const linked = await service.linkAccount(owner.id, "auth-identity-1");

      expect(linked.authIdentityId).toBe("auth-identity-1");
    });

    it("throws OwnerNotFoundError when the Owner does not exist", async () => {
      await expect(service.linkAccount("no-such-owner", "auth-identity-1")).rejects.toBeInstanceOf(OwnerNotFoundError);
    });
  });

  describe("BR-CUST-5 — Multi-pet bookings are unrestricted in count", () => {
    it("allows adding an arbitrary number of pets to one Owner with no cap enforced", async () => {
      const owner = await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });

      for (let i = 0; i < 12; i++) {
        await service.addPet(owner.id, { name: `Pet ${i}`, breed: "Mixed", size: "Medium" });
      }

      const withPets = await service.getOwner(owner.id);
      expect(withPets?.pets).toHaveLength(12);
    });
  });

  describe("BR-CUST-6 — Pet fields: size must be one of the fixed categories", () => {
    it.each(["Small", "Medium", "Large", "XL"] as const)("accepts the valid size %s", async (size) => {
      const owner = await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });
      const pet = await service.addPet(owner.id, { name: "Rex", breed: "Labrador", size });
      expect(pet.size).toBe(size);
    });

    it("rejects an invalid size on addPet", async () => {
      const owner = await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });
      await expect(
        service.addPet(owner.id, { name: "Rex", breed: "Labrador", size: "Massive" as never }),
      ).rejects.toBeInstanceOf(CustomerValidationError);
    });

    it("rejects an invalid size on updatePet", async () => {
      const owner = await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });
      const pet = await service.addPet(owner.id, { name: "Rex", breed: "Labrador", size: "Small" });
      await expect(service.updatePet(pet.id, { size: "Massive" as never })).rejects.toBeInstanceOf(CustomerValidationError);
    });
  });

  describe("BR-CUST-7 — Owner/pet data is always shop-owner-visible and editable, never gated by account status", () => {
    it("returns full Owner + pet data for a guest Owner (authIdentityId null)", async () => {
      const owner = await repository.createOwner({ name: "Guest Person", phone: "555-3333", email: "guest@example.com" });
      await service.addPet(owner.id, { name: "Fido", breed: "Beagle", size: "Small" });

      const result = await service.getOwner(owner.id);

      expect(result?.authIdentityId).toBeNull();
      expect(result?.pets).toHaveLength(1);
    });

    it("returns the same full Owner + pet data for an account-linked Owner", async () => {
      const owner = await repository.createOwner({ name: "Linked Person", phone: "555-4444", email: "linked@example.com" });
      await repository.linkOwnerToAuthIdentity(owner.id, "auth-identity-9");
      await service.addPet(owner.id, { name: "Whiskers", breed: "Tabby", size: "Small" });

      const result = await service.getOwner(owner.id);

      expect(result?.authIdentityId).toBe("auth-identity-9");
      expect(result?.pets).toHaveLength(1);
    });
  });

  describe("Flow 5 — Add/Update Pet, not-found paths and field-level validation", () => {
    it("addPet throws OwnerNotFoundError when the owner does not exist", async () => {
      await expect(service.addPet("no-such-owner", { name: "Rex", breed: "Labrador", size: "Small" })).rejects.toBeInstanceOf(
        OwnerNotFoundError,
      );
    });

    it("updatePet throws PetNotFoundError when the pet does not exist", async () => {
      await expect(service.updatePet("no-such-pet", { name: "New Name" })).rejects.toBeInstanceOf(PetNotFoundError);
    });

    it("addPet rejects a missing pet name", async () => {
      const owner = await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });
      await expect(service.addPet(owner.id, { name: "", breed: "Labrador", size: "Small" })).rejects.toBeInstanceOf(
        CustomerValidationError,
      );
    });
  });

  describe("Owner not-found / validation paths outside Flow 1", () => {
    it("getOwner returns null for an unknown ownerId", async () => {
      await expect(service.getOwner("no-such-owner")).resolves.toBeNull();
    });

    it("updateOwner throws OwnerNotFoundError when the owner does not exist", async () => {
      await expect(service.updateOwner("no-such-owner", { name: "X" })).rejects.toBeInstanceOf(OwnerNotFoundError);
    });

    it("updateOwner rejects an invalid email when one is provided", async () => {
      const owner = await repository.createOwner({ name: "Jane Doe", phone: "555-0100", email: "jane@example.com" });
      await expect(service.updateOwner(owner.id, { email: "not-an-email" })).rejects.toBeInstanceOf(CustomerValidationError);
    });
  });
});
