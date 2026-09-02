// catalog module error types — thrown by the business logic in service.ts, caught and
// mapped to HTTP responses by the API layer (Code Generation Step 12, out of scope here).

export class CatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogValidationError";
  }
}

export class ServiceNotFoundError extends Error {
  constructor(serviceId: string) {
    super(`Service not found: ${serviceId}`);
    this.name = "ServiceNotFoundError";
  }
}
