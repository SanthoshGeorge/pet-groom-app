// customer module domain types — mirror the `Owner`, `Pet`, and `Groomer` models in
// prisma/schema.prisma. Pure TypeScript so business logic compiles without the
// (not-yet-generated) Prisma client — see repository.ts for the abstraction boundary.

/** Pet.size — fixed category (BR-CUST-6 / Q7=A), matches prisma/schema.prisma's `PetSize` enum. */
export type PetSize = "Small" | "Medium" | "Large" | "XL";

/** A pet owner / customer — guest or account-linked. functional-design/domain-entities.md "Owner". */
export interface Owner {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string | null;
  notes: string | null;
  /** Set once this Owner links or creates an account (RC-1, BR-CUST-4); null for guest-only owners. */
  authIdentityId: string | null;
  createdAt: Date;
}

export interface OwnerWithPets extends Owner {
  pets: Pet[];
}

/** A pet belonging to an Owner. functional-design/domain-entities.md "Pet". */
export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  /** Free text (Q7=A — too many breeds/mixes to enumerate). */
  breed: string;
  size: PetSize;
  age: number | null;
  temperamentNotes: string | null;
  allergyMedicalNotes: string | null;
  createdAt: Date;
}

/**
 * A groomer/staff member (minimal, per FR-2 and Q6=A). Owned by `customer` per
 * domain-entities.md's Entity Summary, but no CRUD method for it appears anywhere in
 * component-methods.md or business-rules.md's BR-CUST-1..7 — v1 has exactly one Groomer,
 * auto-assigned, with no self-service management flow. The type is included here for
 * other modules (`booking`) to reference; no repository/service methods are defined for
 * it in this pass since none is called for by any numbered business rule or flow (see
 * the Code Generation report's "judgment calls" section for this explicit scope note).
 */
export interface Groomer {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
}

/** Guest/customer-supplied contact info — input to identity resolution (Flow 1). */
export interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

export interface OwnerUpdateInput {
  name?: string;
  phone?: string;
  email?: string;
  address?: string | null;
  notes?: string | null;
}

export interface PetCreateInput {
  ownerId: string;
  name: string;
  breed: string;
  size: PetSize;
  age?: number | null;
  temperamentNotes?: string | null;
  allergyMedicalNotes?: string | null;
}

export interface PetUpdateInput {
  name?: string;
  breed?: string;
  size?: PetSize;
  age?: number | null;
  temperamentNotes?: string | null;
  allergyMedicalNotes?: string | null;
}
