// catalog module (CatalogService) — Code Generation Phase B, Step 5.
// Implements BR-CAT-1..5 (business-rules.md) and Flow 6 (business-logic-model.md).

export type { CreateServiceInput, Service, UpdateServiceInput } from "./types";
export { CatalogValidationError, ServiceNotFoundError } from "./errors";
export type { CatalogRepository } from "./repository";
export { createCatalogService } from "./service";
export type { CatalogService } from "./service";
