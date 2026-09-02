// Integration tests for the admin catalog-management routes (Code Generation Step 15):
// POST /api/admin/services, PATCH /api/admin/services/:id — SO-4, owner-gated via
// `requireOwnerSession`.

import "./test-helpers/fake-next-headers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createServicePost } from "@/app/api/admin/services/route";
import { PATCH as updateServicePatch } from "@/app/api/admin/services/[id]/route";
import { SESSION_COOKIE_NAME } from "@/server/session";
import { __resetServicesForTesting, __setServicesForTesting } from "@/server/container";
import { buildTestServices, type TestServicesBundle } from "./test-helpers/build-test-services";
import { jsonRequest } from "./test-helpers/request";
import { resetFakeCookieJar, seedCookie } from "./test-helpers/fake-next-headers";

const SERVICES_URL = "http://localhost/api/admin/services";

async function loginAsOwner(bundle: TestServicesBundle) {
  const identity = await bundle.repos.auth.createIdentity({
    email: "shop@example.com",
    passwordHash: "irrelevant",
    role: "owner",
    ownerId: null,
  });
  const session = await bundle.repos.auth.createSession({ authIdentityId: identity.id, role: "owner" });
  seedCookie(SESSION_COOKIE_NAME, session.id);
}

async function loginAsCustomer(bundle: TestServicesBundle) {
  const { session } = await bundle.auth.registerAccount("jane@example.com", "password123", {
    name: "Jane Doe",
    phone: "555-0100",
    email: "jane@example.com",
  });
  seedCookie(SESSION_COOKIE_NAME, session.id);
}

describe("admin catalog-management routes", () => {
  let bundle: TestServicesBundle;

  beforeEach(async () => {
    bundle = await buildTestServices();
    __setServicesForTesting(bundle.services);
    resetFakeCookieJar();
  });

  afterEach(() => {
    __resetServicesForTesting();
  });

  describe("POST /api/admin/services", () => {
    it("401s with no session cookie at all", async () => {
      const res = await createServicePost(jsonRequest(SERVICES_URL, "POST", { name: "Bath", price: 30, durationMinutes: 30 }));
      expect(res.status).toBe(401);
    });

    it("403s for a role=customer session", async () => {
      await loginAsCustomer(bundle);
      const res = await createServicePost(jsonRequest(SERVICES_URL, "POST", { name: "Bath", price: 30, durationMinutes: 30 }));
      expect(res.status).toBe(403);
    });

    it("201s with { service } for a valid owner session — SO-4", async () => {
      await loginAsOwner(bundle);
      const res = await createServicePost(jsonRequest(SERVICES_URL, "POST", { name: "Bath", price: 30, durationMinutes: 30 }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.service).toMatchObject({ name: "Bath", price: 30, durationMinutes: 30, active: true });
    });

    it("400s when a required field (durationMinutes) is missing — BR-CAT-5", async () => {
      await loginAsOwner(bundle);
      const res = await createServicePost(jsonRequest(SERVICES_URL, "POST", { name: "Bath", price: 30 }));
      expect(res.status).toBe(400);
    });

    it("400s on malformed JSON body", async () => {
      await loginAsOwner(bundle);
      const res = await createServicePost(
        new Request(SERVICES_URL, { method: "POST", headers: { "content-type": "application/json" }, body: "{not valid json" }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/admin/services/:id", () => {
    it("401s with no session cookie at all", async () => {
      const res = await updateServicePatch(jsonRequest(`${SERVICES_URL}/some-id`, "PATCH", { price: 40 }), {
        params: Promise.resolve({ id: "some-id" }),
      });
      expect(res.status).toBe(401);
    });

    it("403s for a role=customer session", async () => {
      await loginAsCustomer(bundle);
      const res = await updateServicePatch(jsonRequest(`${SERVICES_URL}/some-id`, "PATCH", { price: 40 }), {
        params: Promise.resolve({ id: "some-id" }),
      });
      expect(res.status).toBe(403);
    });

    it("200s and edits a service's live fields for a valid owner session — BR-CAT-3", async () => {
      await loginAsOwner(bundle);
      const service = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });

      const res = await updateServicePatch(jsonRequest(`${SERVICES_URL}/${service.id}`, "PATCH", { price: 35 }), {
        params: Promise.resolve({ id: service.id }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.service).toMatchObject({ id: service.id, price: 35 });
    });

    it("200s and deactivates a service when { active: false } — BR-CAT-2 (soft delete only)", async () => {
      await loginAsOwner(bundle);
      const service = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });

      const res = await updateServicePatch(jsonRequest(`${SERVICES_URL}/${service.id}`, "PATCH", { active: false }), {
        params: Promise.resolve({ id: service.id }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.service).toMatchObject({ id: service.id, active: false });
    });

    it("400s for { active: true } — reactivation is not supported", async () => {
      await loginAsOwner(bundle);
      const service = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });

      const res = await updateServicePatch(jsonRequest(`${SERVICES_URL}/${service.id}`, "PATCH", { active: true }), {
        params: Promise.resolve({ id: service.id }),
      });
      expect(res.status).toBe(400);
    });

    it("400s when the body has no editable fields at all", async () => {
      await loginAsOwner(bundle);
      const service = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });

      const res = await updateServicePatch(jsonRequest(`${SERVICES_URL}/${service.id}`, "PATCH", {}), {
        params: Promise.resolve({ id: service.id }),
      });
      expect(res.status).toBe(400);
    });

    it("404s for an unknown service id", async () => {
      await loginAsOwner(bundle);
      const res = await updateServicePatch(jsonRequest(`${SERVICES_URL}/does-not-exist`, "PATCH", { price: 40 }), {
        params: Promise.resolve({ id: "does-not-exist" }),
      });
      expect(res.status).toBe(404);
    });
  });
});
