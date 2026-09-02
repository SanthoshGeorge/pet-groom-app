// customer module (CustomerService: Owner + Pet) — Code Generation Phase B, Step 4.
// Implements BR-CUST-1..7 (business-rules.md) and Flows 1 & 5 (business-logic-model.md).

export type {
  ContactInfo,
  Groomer,
  Owner,
  OwnerUpdateInput,
  OwnerWithPets,
  Pet,
  PetCreateInput,
  PetSize,
  PetUpdateInput,
} from "./types";
export { CustomerValidationError, OwnerNotFoundError, PetNotFoundError } from "./errors";
export type { CustomerRepository } from "./repository";
export { createCustomerService } from "./service";
export type { CustomerService } from "./service";
