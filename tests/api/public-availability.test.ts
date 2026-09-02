// Integration tests for GET /api/availability (Code Generation Step 15). See
// public-services.test.ts's header comment for the shared adaptation rationale.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/availability/route";
import { __resetServicesForTesting, __setServicesForTesting } from "@/server/container";
import { buildTestServices, type TestServicesBundle } from "./test-helpers/build-test-services";
import { nextGetRequest } from "./test-helpers/request";

describe("GET /api/availability", () => {
  let bundle: TestServicesBundle;

  beforeEach(async () => {
    bundle = await buildTestServices();
    await bundle.setAllDayHours();
    __setServicesForTesting(bundle.services);
  });

  afterEach(() => {
    __resetServicesForTesting();
  });

  it("200s with { slots } shaped as { start, end, serviceId } for a valid service/date range — GC-1/BR-AVAIL-1/3", async () => {
    const bath = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const res = await GET(
      nextGetRequest(`http://localhost/api/availability?serviceId=${bath.id}&start=${start}&end=${end}`),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.slots)).toBe(true);
    expect(body.slots.length).toBeGreaterThan(0);
    const slot = body.slots[0];
    expect(slot).toHaveProperty("start");
    expect(slot).toHaveProperty("end");
    expect(slot.serviceId).toBe(bath.id);
  });

  it("400s when serviceId is missing", async () => {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 86400000).toISOString();
    const res = await GET(nextGetRequest(`http://localhost/api/availability?start=${start}&end=${end}`));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/serviceId/i);
  });

  it("400s when start is missing", async () => {
    const bath = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
    const end = new Date(Date.now() + 86400000).toISOString();
    const res = await GET(nextGetRequest(`http://localhost/api/availability?serviceId=${bath.id}&end=${end}`));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/start/i);
  });

  it("400s when start is not a valid date", async () => {
    const bath = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
    const end = new Date(Date.now() + 86400000).toISOString();
    const res = await GET(
      nextGetRequest(`http://localhost/api/availability?serviceId=${bath.id}&start=not-a-date&end=${end}`),
    );
    expect(res.status).toBe(400);
  });

  it("404s when serviceId doesn't reference a real service", async () => {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 86400000).toISOString();
    const res = await GET(
      nextGetRequest(`http://localhost/api/availability?serviceId=nonexistent-id&start=${start}&end=${end}`),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/service/i);
  });
});
