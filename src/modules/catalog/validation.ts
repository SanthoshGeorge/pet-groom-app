// Manual, per-function input validation — no schema-validation library, per
// nfr-design-patterns.md's Security Patterns ("Input validation: manual, per-route
// (Q5=B)"). Applied here at the business-logic layer (not just a future API route)
// so BR-CAT-5 is enforced as real logic regardless of what a later route layer does.

import { CatalogValidationError } from "./errors";
import type { CreateServiceInput, UpdateServiceInput } from "./types";

/** BR-CAT-5 — name/price/duration are all required on creation. */
export function validateCreateServiceInput(input: CreateServiceInput): void {
  if (!input.name || !input.name.trim()) {
    throw new CatalogValidationError("name is required");
  }
  if (input.price === undefined || input.price === null || Number.isNaN(input.price)) {
    throw new CatalogValidationError("price is required");
  }
  if (input.price < 0) {
    throw new CatalogValidationError("price must be zero or greater");
  }
  if (
    input.durationMinutes === undefined ||
    input.durationMinutes === null ||
    Number.isNaN(input.durationMinutes)
  ) {
    throw new CatalogValidationError("duration is required");
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
    throw new CatalogValidationError("durationMinutes must be a positive integer");
  }
}

/** Same field-level constraints as creation, applied only to the fields actually present (BR-CAT-3 — partial edits of the live row). */
export function validateUpdateServiceInput(fields: UpdateServiceInput): void {
  if (fields.name !== undefined && !fields.name.trim()) {
    throw new CatalogValidationError("name cannot be blank");
  }
  if (fields.price !== undefined) {
    if (Number.isNaN(fields.price) || fields.price < 0) {
      throw new CatalogValidationError("price must be zero or greater");
    }
  }
  if (fields.durationMinutes !== undefined) {
    if (!Number.isInteger(fields.durationMinutes) || fields.durationMinutes <= 0) {
      throw new CatalogValidationError("durationMinutes must be a positive integer");
    }
  }
}
