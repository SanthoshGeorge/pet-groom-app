// In-memory fake of CatalogRepository (src/modules/catalog/repository.ts), for unit
// testing CatalogService (and, indirectly, `availability`, which depends on the real
// CatalogService built on top of this fake — see tests/fakes/availability.fake.ts).

import { randomUUID } from "node:crypto";
import type { CatalogRepository } from "@/modules/catalog/repository";
import type { CreateServiceInput, Service, UpdateServiceInput } from "@/modules/catalog/types";

export interface FakeCatalogRepository extends CatalogRepository {
  _services: Map<string, Service>;
}

export function createFakeCatalogRepository(): FakeCatalogRepository {
  const services = new Map<string, Service>();

  return {
    _services: services,

    async findServiceById(serviceId) {
      return services.get(serviceId) ?? null;
    },

    async listActiveServices() {
      return [...services.values()].filter((s) => s.active);
    },

    async listAllServices() {
      return [...services.values()];
    },

    async createService(input: CreateServiceInput) {
      const now = new Date();
      const service: Service = {
        id: randomUUID(),
        name: input.name,
        price: input.price,
        durationMinutes: input.durationMinutes,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      services.set(service.id, service);
      return service;
    },

    async updateService(serviceId, fields: UpdateServiceInput) {
      const existing = services.get(serviceId);
      if (!existing) throw new Error(`fake: no service ${serviceId}`);
      const updated: Service = { ...existing, ...fields, updatedAt: new Date() };
      services.set(serviceId, updated);
      return updated;
    },

    async setServiceActive(serviceId, active) {
      const existing = services.get(serviceId);
      if (!existing) throw new Error(`fake: no service ${serviceId}`);
      const updated: Service = { ...existing, active, updatedAt: new Date() };
      services.set(serviceId, updated);
      return updated;
    },
  };
}
