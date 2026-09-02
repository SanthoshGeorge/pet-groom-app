// CustomerService business logic — implements BR-CUST-1..7 and Flow 1 (Guest/Owner
// Identity Resolution) + Flow 5 (Add/Update Pet) from business-logic-model.md. Pure
// TypeScript: depends only on the CustomerRepository abstraction, no Prisma import.

import { OwnerNotFoundError, PetNotFoundError } from "./errors";
import type { CustomerRepository } from "./repository";
import type {
  ContactInfo,
  Owner,
  OwnerUpdateInput,
  OwnerWithPets,
  Pet,
  PetCreateInput,
  PetUpdateInput,
} from "./types";
import {
  validateContactInfo,
  validateOwnerEmail,
  validateOwnerPhone,
  validatePetCreateInput,
  validatePetUpdateInput,
} from "./validation";

export interface CustomerService {
  /** Flow 1 — BR-CUST-1/2/3: finds-or-creates an Owner by contact info. Used identically by guest bookings (GC-2) and owner-on-behalf bookings (SO-2), and by `registerAccount` (Flow 2 step 2, BR-CUST-4). */
  createOrFindOwner(contact: ContactInfo): Promise<Owner>;
  /** BR-CUST-7 — never gated by account-linked status. */
  getOwner(ownerId: string): Promise<OwnerWithPets | null>;
  updateOwner(ownerId: string, fields: OwnerUpdateInput): Promise<Owner>;
  /** Flow 5 — BR-CUST-5 (no cap), BR-CUST-6 (size validated). */
  addPet(ownerId: string, petDetails: Omit<PetCreateInput, "ownerId">): Promise<Pet>;
  updatePet(petId: string, fields: PetUpdateInput): Promise<Pet>;
  /** BR-CUST-4 — connects a guest Owner record to a newly created/linked AuthIdentity (RC-1). */
  linkAccount(ownerId: string, authIdentityId: string): Promise<Owner>;
}

/**
 * Factory taking a repository implementation — Step 17 wires in the Prisma-backed
 * `CustomerRepository`; nothing here depends on how the repository is implemented.
 */
export function createCustomerService(repository: CustomerRepository): CustomerService {
  /** BR-CUST-2 — additive update: only overwrite fields the new booking actually provided a different value for. */
  function diffAdditiveUpdate(existing: Owner, contact: ContactInfo): OwnerUpdateInput {
    const updates: OwnerUpdateInput = {};
    if (contact.name && contact.name !== existing.name) {
      updates.name = contact.name;
    }
    if (contact.phone && contact.phone !== existing.phone) {
      updates.phone = contact.phone;
    }
    if (contact.email && contact.email !== existing.email) {
      updates.email = contact.email;
    }
    return updates;
  }

  return {
    async createOrFindOwner(contact) {
      validateContactInfo(contact);

      // Flow 1, step 1: email lookup first. Running email before phone (and returning
      // immediately on a hit) is itself the mechanism that satisfies BR-CUST-3's
      // "ambiguous match -> prefer email" tie-break — if a match is found here, the
      // phone lookup below never runs, so an owner that would also have matched by
      // phone is never even considered.
      const byEmail = await repository.findOwnerByEmail(contact.email);
      if (byEmail) {
        const updates = diffAdditiveUpdate(byEmail, contact);
        if (Object.keys(updates).length === 0) return byEmail;
        return repository.updateOwner(byEmail.id, updates); // BR-CUST-2
      }

      // Flow 1, step 2.
      const byPhone = await repository.findOwnerByPhone(contact.phone);
      if (byPhone) {
        const updates = diffAdditiveUpdate(byPhone, contact);
        if (Object.keys(updates).length === 0) return byPhone;
        return repository.updateOwner(byPhone.id, updates); // BR-CUST-2
      }

      // Flow 1, step 3.
      return repository.createOwner(contact);
    },

    async getOwner(ownerId) {
      const owner = await repository.findOwnerById(ownerId);
      if (!owner) return null;
      // BR-CUST-7 — visibility/editability is never gated by authIdentityId; this
      // returns full owner + pet data for guest and account-linked owners alike.
      const pets = await repository.listPetsByOwner(ownerId);
      return { ...owner, pets };
    },

    async updateOwner(ownerId, fields) {
      const existing = await repository.findOwnerById(ownerId);
      if (!existing) {
        throw new OwnerNotFoundError(ownerId);
      }
      if (fields.email !== undefined) validateOwnerEmail(fields.email);
      if (fields.phone !== undefined) validateOwnerPhone(fields.phone);
      return repository.updateOwner(ownerId, fields);
    },

    async addPet(ownerId, petDetails) {
      const owner = await repository.findOwnerById(ownerId);
      if (!owner) {
        throw new OwnerNotFoundError(ownerId); // Flow 5 (addPet), step 1
      }
      const input: PetCreateInput = { ownerId, ...petDetails };
      validatePetCreateInput(input); // Flow 5 (addPet), step 2 — BR-CUST-6
      // No cap on pets per owner (BR-CUST-5) — nothing here counts existing pets.
      return repository.createPet(input);
    },

    async updatePet(petId, fields) {
      const existing = await repository.findPetById(petId);
      if (!existing) {
        throw new PetNotFoundError(petId); // Flow 5 (updatePet), step 1
      }
      validatePetUpdateInput(fields); // Flow 5 (updatePet), step 2
      return repository.updatePet(petId, fields);
    },

    async linkAccount(ownerId, authIdentityId) {
      const existing = await repository.findOwnerById(ownerId);
      if (!existing) {
        throw new OwnerNotFoundError(ownerId);
      }
      // BR-CUST-4 — sets Owner.authIdentityId, connecting the guest record to the account.
      return repository.linkOwnerToAuthIdentity(ownerId, authIdentityId);
    },
  };
}
