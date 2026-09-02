// catalog module data-access contract — pure interface, no implementation.
//
// Business logic (service.ts) depends only on this abstraction, never on Prisma
// directly (Prisma's generated client can't run in this environment yet — see the
// Code Generation plan, Step 17). A Prisma-backed implementation of this interface
// gets wired in during Phase F (`src/modules/catalog/repository.prisma.ts` or similar,
// constructed and passed into `createCatalogService`).

import type { CreateServiceInput, Service, UpdateServiceInput } from "./types";

export interface CatalogRepository {
  findServiceById(serviceId: string): Promise<Service | null>;
  /** BR-CAT-1 — only `active = true` rows. */
  listActiveServices(): Promise<Service[]>;
  /** Admin-scoped listing (active + inactive) — see frontend-components.md's `AdminServicesPage` note; not one of the 9 answered FD questions, added here as an implementation-level necessity for Code Generation. */
  listAllServices(): Promise<Service[]>;
  createService(input: CreateServiceInput): Promise<Service>;
  updateService(serviceId: string, fields: UpdateServiceInput): Promise<Service>;
  /** BR-CAT-2 — sets `active`, never deletes the row. */
  setServiceActive(serviceId: string, active: boolean): Promise<Service>;
}
