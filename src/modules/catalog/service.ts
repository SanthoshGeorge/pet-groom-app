// CatalogService business logic — implements BR-CAT-1..5 and the "Flow 6: Service
// Catalog Management" flow from business-logic-model.md. Pure TypeScript: depends only
// on the CatalogRepository abstraction, no Prisma import.

import { ServiceNotFoundError } from "./errors";
import type { CatalogRepository } from "./repository";
import type { CreateServiceInput, Service, UpdateServiceInput } from "./types";
import { validateCreateServiceInput, validateUpdateServiceInput } from "./validation";

export interface CatalogService {
  /** BR-CAT-1 — bookable services only. */
  listActiveServices(): Promise<Service[]>;
  /** Admin listing (active + inactive) — see repository.ts's note on this method. */
  listAllServices(): Promise<Service[]>;
  /** Returns any Service regardless of `active` state — a past Appointment must still be able to display a deactivated service's name (business-logic-model.md, Flow 6). */
  getService(serviceId: string): Promise<Service | null>;
  /** SO-4 — BR-CAT-5 enforced. */
  createService(input: CreateServiceInput): Promise<Service>;
  /** SO-4 — BR-CAT-3: changes the live row only. */
  updateService(serviceId: string, fields: UpdateServiceInput): Promise<Service>;
  /** SO-4 — BR-CAT-2: soft-deactivate, row is never deleted. */
  deactivateService(serviceId: string): Promise<void>;
}

/**
 * Factory taking a repository implementation — Step 17 wires in the Prisma-backed
 * `CatalogRepository`; nothing here depends on how the repository is implemented.
 */
export function createCatalogService(repository: CatalogRepository): CatalogService {
  return {
    async listActiveServices() {
      return repository.listActiveServices();
    },

    async listAllServices() {
      return repository.listAllServices();
    },

    async getService(serviceId) {
      return repository.findServiceById(serviceId);
    },

    async createService(input) {
      validateCreateServiceInput(input); // BR-CAT-5
      return repository.createService(input);
    },

    async updateService(serviceId, fields) {
      const existing = await repository.findServiceById(serviceId);
      if (!existing) {
        throw new ServiceNotFoundError(serviceId);
      }
      validateUpdateServiceInput(fields);
      // BR-CAT-3 — this only ever touches the live Service row. Already-created
      // Appointment/AppointmentLineItem rows keep their own price/duration snapshot
      // (BR-CAT-4), taken at booking time by the `booking` module — nothing here can
      // retroactively change a past appointment even if it wanted to, since this method
      // never touches Appointment/AppointmentLineItem at all.
      return repository.updateService(serviceId, fields);
    },

    async deactivateService(serviceId) {
      const existing = await repository.findServiceById(serviceId);
      if (!existing) {
        throw new ServiceNotFoundError(serviceId);
      }
      await repository.setServiceActive(serviceId, false); // BR-CAT-2
    },
  };
}
