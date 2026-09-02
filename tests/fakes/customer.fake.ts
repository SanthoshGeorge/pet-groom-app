// In-memory fake of CustomerRepository (src/modules/customer/repository.ts), for unit
// testing CustomerService (and, structurally, anything wired against `customer`'s
// service as an `OwnerIdentityResolver`, e.g. `auth`'s registerAccount) without a real
// database. Mirrors the interface's documented contract (exact-match lookups, etc.)
// closely enough to exercise every BR-CUST-* rule faithfully.

import { randomUUID } from "node:crypto";
import type { CustomerRepository } from "@/modules/customer/repository";
import type { Owner, OwnerUpdateInput, Pet, PetCreateInput, PetUpdateInput, ContactInfo } from "@/modules/customer/types";

export interface FakeCustomerRepository extends CustomerRepository {
  /** Test-only inspection helpers — not part of the CustomerRepository contract. */
  _owners: Map<string, Owner>;
  _pets: Map<string, Pet>;
}

export function createFakeCustomerRepository(): FakeCustomerRepository {
  const owners = new Map<string, Owner>();
  const pets = new Map<string, Pet>();

  return {
    _owners: owners,
    _pets: pets,

    async findOwnerById(ownerId) {
      return owners.get(ownerId) ?? null;
    },

    async findOwnerByEmail(email) {
      for (const owner of owners.values()) {
        if (owner.email === email) return owner;
      }
      return null;
    },

    async findOwnerByPhone(phone) {
      for (const owner of owners.values()) {
        if (owner.phone === phone) return owner;
      }
      return null;
    },

    async createOwner(input: ContactInfo) {
      const owner: Owner = {
        id: randomUUID(),
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: null,
        notes: null,
        authIdentityId: null,
        createdAt: new Date(),
      };
      owners.set(owner.id, owner);
      return owner;
    },

    async updateOwner(ownerId, fields: OwnerUpdateInput) {
      const existing = owners.get(ownerId);
      if (!existing) throw new Error(`fake: no owner ${ownerId}`);
      const updated: Owner = { ...existing, ...fields };
      owners.set(ownerId, updated);
      return updated;
    },

    async linkOwnerToAuthIdentity(ownerId, authIdentityId) {
      const existing = owners.get(ownerId);
      if (!existing) throw new Error(`fake: no owner ${ownerId}`);
      const updated: Owner = { ...existing, authIdentityId };
      owners.set(ownerId, updated);
      return updated;
    },

    async listPetsByOwner(ownerId) {
      return [...pets.values()].filter((p) => p.ownerId === ownerId);
    },

    async findPetById(petId) {
      return pets.get(petId) ?? null;
    },

    async createPet(input: PetCreateInput) {
      const pet: Pet = {
        id: randomUUID(),
        ownerId: input.ownerId,
        name: input.name,
        breed: input.breed,
        size: input.size,
        age: input.age ?? null,
        temperamentNotes: input.temperamentNotes ?? null,
        allergyMedicalNotes: input.allergyMedicalNotes ?? null,
        createdAt: new Date(),
      };
      pets.set(pet.id, pet);
      return pet;
    },

    async updatePet(petId, fields: PetUpdateInput) {
      const existing = pets.get(petId);
      if (!existing) throw new Error(`fake: no pet ${petId}`);
      const updated: Pet = { ...existing, ...fields };
      pets.set(petId, updated);
      return updated;
    },
  };
}
