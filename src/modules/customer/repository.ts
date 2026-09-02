// customer module data-access contract — pure interface, no implementation. Business
// logic (service.ts) depends only on this abstraction, never on Prisma directly. A
// Prisma-backed implementation is wired in during Phase F, Step 17.

import type {
  ContactInfo,
  Owner,
  OwnerUpdateInput,
  Pet,
  PetCreateInput,
  PetUpdateInput,
} from "./types";

export interface CustomerRepository {
  findOwnerById(ownerId: string): Promise<Owner | null>;
  /** Exact match, per BR-CUST-1 step 1. */
  findOwnerByEmail(email: string): Promise<Owner | null>;
  /** Exact match, per BR-CUST-1 step 2. */
  findOwnerByPhone(phone: string): Promise<Owner | null>;
  createOwner(input: ContactInfo): Promise<Owner>;
  updateOwner(ownerId: string, fields: OwnerUpdateInput): Promise<Owner>;
  /** BR-CUST-4 — sets `Owner.authIdentityId`, connecting a guest Owner to an account. Kept separate from `updateOwner` since it's a distinct relationship-linking operation, not a general field edit. */
  linkOwnerToAuthIdentity(ownerId: string, authIdentityId: string): Promise<Owner>;

  listPetsByOwner(ownerId: string): Promise<Pet[]>;
  findPetById(petId: string): Promise<Pet | null>;
  createPet(input: PetCreateInput): Promise<Pet>;
  updatePet(petId: string, fields: PetUpdateInput): Promise<Pet>;
}
