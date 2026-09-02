// customer module error types — thrown by service.ts, mapped to HTTP responses by the
// API layer (Code Generation Step 12, out of scope here).

export class CustomerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerValidationError";
  }
}

export class OwnerNotFoundError extends Error {
  constructor(ownerId: string) {
    super(`Owner not found: ${ownerId}`);
    this.name = "OwnerNotFoundError";
  }
}

export class PetNotFoundError extends Error {
  constructor(petId: string) {
    super(`Pet not found: ${petId}`);
    this.name = "PetNotFoundError";
  }
}
