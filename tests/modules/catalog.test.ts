// Unit tests for CatalogService (src/modules/catalog) — Code Generation Step 10.
// Covers every numbered rule in business-rules.md's "Catalog (CatalogService)" section
// (BR-CAT-1..5) plus Flow 6 (Service Catalog Management) from business-logic-model.md.
// Backed by an in-memory fake CatalogRepository (tests/fakes/catalog.fake.ts) — no real
// database involved.

import { beforeEach, describe, expect, it } from "vitest";
import { createCatalogService, type CatalogService } from "@/modules/catalog/service";
import { CatalogValidationError, ServiceNotFoundError } from "@/modules/catalog/errors";
import { createFakeCatalogRepository, type FakeCatalogRepository } from "../fakes/catalog.fake";

describe("CatalogService", () => {
  let repository: FakeCatalogRepository;
  let service: CatalogService;

  beforeEach(() => {
    repository = createFakeCatalogRepository();
    service = createCatalogService(repository);
  });

  describe("BR-CAT-1 — Only active = true services are bookable", () => {
    it("listActiveServices excludes deactivated services", async () => {
      const active = await service.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const toDeactivate = await service.createService({ name: "Full Groom", price: 60, durationMinutes: 90 });
      await service.deactivateService(toDeactivate.id);

      const result = await service.listActiveServices();

      expect(result.map((s) => s.id)).toEqual([active.id]);
    });
  });

  describe("BR-CAT-2 — Deactivation preserves history, does not delete", () => {
    it("deactivateService sets active = false but the row is still retrievable by id", async () => {
      const created = await service.createService({ name: "Nail Trim", price: 15, durationMinutes: 15 });

      await service.deactivateService(created.id);

      const fetched = await service.getService(created.id);
      expect(fetched?.active).toBe(false);
      expect(fetched?.id).toBe(created.id); // row preserved, not deleted
    });

    it("throws ServiceNotFoundError when deactivating a service that doesn't exist", async () => {
      await expect(service.deactivateService("no-such-service")).rejects.toBeInstanceOf(ServiceNotFoundError);
    });
  });

  describe("BR-CAT-3 — Editing price/duration only affects the live Service row going forward", () => {
    it("updateService changes the live row's price/duration immediately", async () => {
      const created = await service.createService({ name: "Bath", price: 30, durationMinutes: 30 });

      const updated = await service.updateService(created.id, { price: 35, durationMinutes: 40 });

      expect(updated.price).toBe(35);
      expect(updated.durationMinutes).toBe(40);
      // getService reflects the same change — there is exactly one live row, no branching history.
      const refetched = await service.getService(created.id);
      expect(refetched?.price).toBe(35);
      expect(refetched?.durationMinutes).toBe(40);
    });

    it("throws ServiceNotFoundError when updating a service that doesn't exist", async () => {
      await expect(service.updateService("no-such-service", { price: 10 })).rejects.toBeInstanceOf(ServiceNotFoundError);
    });
  });

  describe("BR-CAT-4 — Price/duration snapshot, no separate history table on Service itself", () => {
    it("updateService overwrites the price with no trace of the prior value anywhere on the Service", async () => {
      const created = await service.createService({ name: "Bath", price: 30, durationMinutes: 30 });

      const updated = await service.updateService(created.id, { price: 45 });

      // The catalog module keeps no history/snapshot fields on Service itself (BR-CAT-4's
      // full mechanism lives on `booking`'s AppointmentLineItem, out of this module's
      // scope) — the live row simply reflects only the newest value.
      expect(updated).not.toHaveProperty("priceHistory");
      expect(updated.price).toBe(45);
      expect(Object.keys(updated).sort()).toEqual(
        ["active", "createdAt", "durationMinutes", "id", "name", "price", "updatedAt"].sort(),
      );
    });
  });

  describe("BR-CAT-5 — Service name/price/duration are required on creation", () => {
    it("creates a service when all three fields are present", async () => {
      const service_ = await service.createService({ name: "Full Groom", price: 60, durationMinutes: 90 });
      expect(service_.active).toBe(true);
      expect(service_.name).toBe("Full Groom");
    });

    it("rejects creation when name is missing", async () => {
      await expect(service.createService({ name: "", price: 60, durationMinutes: 90 })).rejects.toBeInstanceOf(
        CatalogValidationError,
      );
    });

    it("rejects creation when price is missing", async () => {
      await expect(
        service.createService({ name: "Full Groom", price: undefined as unknown as number, durationMinutes: 90 }),
      ).rejects.toBeInstanceOf(CatalogValidationError);
    });

    it("rejects creation when durationMinutes is missing or not a positive integer", async () => {
      await expect(service.createService({ name: "Full Groom", price: 60, durationMinutes: 0 })).rejects.toBeInstanceOf(
        CatalogValidationError,
      );
    });
  });

  describe("Flow 6 — listing and lookup", () => {
    it("getService returns a Service regardless of active state (a past appointment must still display it)", async () => {
      const created = await service.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      await service.deactivateService(created.id);

      const result = await service.getService(created.id);

      expect(result).not.toBeNull();
      expect(result?.active).toBe(false);
    });

    it("getService returns null for an unknown id", async () => {
      await expect(service.getService("no-such-service")).resolves.toBeNull();
    });

    it("listAllServices includes both active and inactive services", async () => {
      const a = await service.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const b = await service.createService({ name: "Full Groom", price: 60, durationMinutes: 90 });
      await service.deactivateService(b.id);

      const result = await service.listAllServices();

      expect(result.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
    });
  });
});
