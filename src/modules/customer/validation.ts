// Manual, per-function input validation — no schema-validation library, per
// nfr-design-patterns.md's Security Patterns ("Input validation: manual, per-route
// (Q5=B)"). Applied here at the business-logic layer so BR-CUST-6 is enforced as real
// logic regardless of what a later route layer does.

import { CustomerValidationError } from "./errors";
import type { ContactInfo, PetCreateInput, PetSize, PetUpdateInput } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PET_SIZES: readonly PetSize[] = ["Small", "Medium", "Large", "XL"];

export function validateContactInfo(contact: ContactInfo): void {
  if (!contact.name || !contact.name.trim()) {
    throw new CustomerValidationError("name is required");
  }
  if (!contact.phone || !contact.phone.trim()) {
    throw new CustomerValidationError("phone is required");
  }
  if (!contact.email || !EMAIL_RE.test(contact.email.trim())) {
    throw new CustomerValidationError("a valid email is required");
  }
}

export function validateOwnerEmail(email: string): void {
  if (!EMAIL_RE.test(email.trim())) {
    throw new CustomerValidationError("a valid email is required");
  }
}

export function validateOwnerPhone(phone: string): void {
  if (!phone.trim()) {
    throw new CustomerValidationError("phone cannot be blank");
  }
}

/** BR-CUST-6 — `size` must be one of the fixed categories. */
export function validatePetSize(size: PetSize): void {
  if (!PET_SIZES.includes(size)) {
    throw new CustomerValidationError(
      `size must be one of: ${PET_SIZES.join(", ")}`,
    );
  }
}

function validatePetAge(age: number | null | undefined): void {
  if (age === null || age === undefined) return;
  if (!Number.isInteger(age) || age < 0) {
    throw new CustomerValidationError("age must be a non-negative whole number");
  }
}

/** Flow 5 (addPet) steps 1-2: ownerId existence is checked by the caller (service.ts); this validates the field-level shape. */
export function validatePetCreateInput(input: PetCreateInput): void {
  if (!input.name || !input.name.trim()) {
    throw new CustomerValidationError("pet name is required");
  }
  if (!input.breed || !input.breed.trim()) {
    throw new CustomerValidationError("breed is required");
  }
  validatePetSize(input.size);
  validatePetAge(input.age);
}

/** Flow 5 (updatePet) — same size validation as creation, applied only to fields present. */
export function validatePetUpdateInput(fields: PetUpdateInput): void {
  if (fields.name !== undefined && !fields.name.trim()) {
    throw new CustomerValidationError("pet name cannot be blank");
  }
  if (fields.breed !== undefined && !fields.breed.trim()) {
    throw new CustomerValidationError("breed cannot be blank");
  }
  if (fields.size !== undefined) {
    validatePetSize(fields.size);
  }
  if (fields.age !== undefined) {
    validatePetAge(fields.age);
  }
}
