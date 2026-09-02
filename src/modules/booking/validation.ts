// Manual, per-function input validation — no schema-validation library, per
// nfr-design-patterns.md's Security Patterns ("Input validation: manual, per-route
// (Q5=B)"). Deeper field-level validation of pet details / service ids is intentionally
// left to `customer.addPet`/`catalog.getService` (called by service.ts) rather than
// duplicated here — this file only validates booking's own structural/BR-specific shape.

import { BookingValidationError } from "./errors";
import type { CreateBookingInput, LookupContactInfo } from "./types";

export function validateCreateBookingInput(input: CreateBookingInput): void {
  if (!input.owner) {
    throw new BookingValidationError("owner (contact info or an existing ownerId) is required");
  }
  if (input.owner.kind === "ownerId" && !input.owner.ownerId) {
    throw new BookingValidationError("ownerId is required");
  }
  if (!input.petServicePairs || input.petServicePairs.length === 0) {
    throw new BookingValidationError("at least one pet/service pair is required");
  }
  for (const pair of input.petServicePairs) {
    if (!pair.serviceId) {
      throw new BookingValidationError("serviceId is required for every pet in the visit");
    }
    if (pair.pet.kind === "existingPet" && !pair.pet.petId) {
      throw new BookingValidationError("petId is required when referencing an existing pet");
    }
  }
  if (!input.slotStart || Number.isNaN(input.slotStart.getTime())) {
    throw new BookingValidationError("a valid slotStart is required");
  }
}

/** BR-BOOK-5 — at least one of email/phone must be supplied; reference-only or contact-only lookups are rejected before ever touching the repository. */
export function validateLookupInput(reference: string, contact: LookupContactInfo): void {
  if (!reference || !reference.trim()) {
    throw new BookingValidationError("bookingReference is required");
  }
  const hasEmail = Boolean(contact.email && contact.email.trim());
  const hasPhone = Boolean(contact.phone && contact.phone.trim());
  if (!hasEmail && !hasPhone) {
    throw new BookingValidationError("contact info (email or phone) is required");
  }
}

export function validateRescheduleInput(newSlotStart: Date): void {
  if (!newSlotStart || Number.isNaN(newSlotStart.getTime())) {
    throw new BookingValidationError("a valid newSlotStart is required");
  }
}
