// Step 18 — real-Postgres integration tests for `createPrismaCatalogRepository`
// (src/modules/catalog/prisma/repository.ts).
//
// ============================================================================
// REQUIRES a generated Prisma Client + a real DATABASE_URL — see
// tests/integration/repositories/test-helpers/prisma-client.ts's header comment for the
// full explanation (this container cannot run `npx prisma generate`) and the exact run
// command. This file is excluded from `npx vitest run` (vitest.config.mts), `npx tsc
// --noEmit` (tsconfig.json), and `npx eslint .` (eslint.config.mjs) for that reason —
// see each config's own comment next to its exclusion entry.
// ============================================================================
//
// SCOPE: `catalog` is the lowest-complexity of the 7 modules — no relations it owns, no
// concurrency concerns, no domain-error translation on this repository's own methods
// (`ServiceNotFoundError` is thrown by `service.ts`, not by this repository). Step 10's
// `tests/modules/catalog.test.ts` already covers BR-CAT-1..5 against a fake, so this file
// is deliberately short: it only proves what's NEW at the repository/DB layer — the
// `Decimal` <-> `number` price conversion round-trips correctly, and (the one thing that
// genuinely can't be verified without a real Prisma `update`) that `updateService`'s
// partial-input semantics leave omitted fields untouched. That second point is exactly
// the gap `code/api-layer-summary.md` flagged: the Step 10 fake's naive object-spread
// merge doesn't reproduce Prisma's real "an `undefined` key in `data` means leave this
// column alone" behavior, so it could only ever be proven here.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaCatalogRepository } from "@/modules/catalog/prisma/repository";
import { closeTestPrismaClient, getTestPrismaClient, resetDatabase } from "./test-helpers/prisma-client";

const prisma = getTestPrismaClient();
const repo = createPrismaCatalogRepository(prisma);

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await closeTestPrismaClient();
});

describe("createService / findServiceById", () => {
  it("persists all fields and reads them back, with price converted from Decimal to a plain number", async () => {
    const created = await repo.createService({ name: "Full Groom", price: 65.5, durationMinutes: 90 });
    expect(created.name).toBe("Full Groom");
    expect(created.price).toBe(65.5);
    expect(typeof created.price).toBe("number"); // not a Decimal.js instance
    expect(created.durationMinutes).toBe(90);
    expect(created.active).toBe(true); // schema default

    const found = await repo.findServiceById(created.id);
    expect(found?.price).toBe(65.5);
  });

  it("findServiceById returns null for an unknown id", async () => {
    expect(await repo.findServiceById("nonexistent-id")).toBeNull();
  });
});

describe("listActiveServices / listAllServices", () => {
  it("BR-CAT-1 — listActiveServices returns only active=true rows, ordered by name; listAllServices returns every row", async () => {
    await repo.createService({ name: "Zebra Wash", price: 10, durationMinutes: 15 });
    const inactive = await repo.createService({ name: "Ancient Trim", price: 20, durationMinutes: 30 });
    await repo.setServiceActive(inactive.id, false);
    await repo.createService({ name: "Middle Bath", price: 30, durationMinutes: 45 });

    const active = await repo.listActiveServices();
    expect(active.map((s) => s.name)).toEqual(["Middle Bath", "Zebra Wash"]); // alphabetical, inactive excluded

    const all = await repo.listAllServices();
    expect(all).toHaveLength(3);
  });
});

describe("updateService — real Prisma partial-update semantics", () => {
  it("BR-CAT-3 — leaves fields not present in the partial input untouched (undefined means 'don't change this column')", async () => {
    const created = await repo.createService({ name: "Original Name", price: 40, durationMinutes: 60 });

    const updated = await repo.updateService(created.id, { price: 45 });

    expect(updated.price).toBe(45);
    expect(updated.name).toBe("Original Name"); // NOT clobbered
    expect(updated.durationMinutes).toBe(60); // NOT clobbered
  });
});

describe("setServiceActive", () => {
  it("BR-CAT-2 — toggles active without touching other fields, and never deletes the row", async () => {
    const created = await repo.createService({ name: "Nail Trim", price: 15, durationMinutes: 20 });
    const deactivated = await repo.setServiceActive(created.id, false);
    expect(deactivated.active).toBe(false);
    expect(deactivated.name).toBe("Nail Trim");

    const reactivated = await repo.setServiceActive(created.id, true);
    expect(reactivated.active).toBe(true);
    expect(await repo.findServiceById(created.id)).not.toBeNull(); // still exists — deactivate, not delete
  });
});
