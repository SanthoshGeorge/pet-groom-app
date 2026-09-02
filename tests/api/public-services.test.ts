// Integration tests for GET /api/services (Code Generation Step 15).
//
// Route handler is imported and invoked directly (per this step's documented adaptation —
// see src/server/container.ts's __setServicesForTesting doc comment), wired through the
// composition root's test-override hook to real services built on Step 10's in-memory
// fakes (tests/api/test-helpers/build-test-services.ts). No session/cookie handling on this
// route, so the plain (non-mocked) container is sufficient here.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/services/route";
import { __resetServicesForTesting, __setServicesForTesting } from "@/server/container";
import { buildTestServices, type TestServicesBundle } from "./test-helpers/build-test-services";

describe("GET /api/services", () => {
  let bundle: TestServicesBundle;

  beforeEach(async () => {
    bundle = await buildTestServices();
    __setServicesForTesting(bundle.services);
  });

  afterEach(() => {
    __resetServicesForTesting();
  });

  it("200s with { services } containing only active (bookable) services — BR-CAT-1", async () => {
    const bath = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
    const fullGroom = await bundle.catalog.createService({ name: "Full Groom", price: 60, durationMinutes: 90 });
    await bundle.catalog.deactivateService(fullGroom.id);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.services)).toBe(true);
    expect(body.services).toHaveLength(1);
    expect(body.services[0]).toMatchObject({ id: bath.id, name: "Bath", price: 30, durationMinutes: 30, active: true });
    expect(body.services.some((s: { id: string }) => s.id === fullGroom.id)).toBe(false);
  });

  it("200s with an empty array when no services exist", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ services: [] });
  });
});
