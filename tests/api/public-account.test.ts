// Integration tests for GET/PATCH /api/account/pets (Code Generation Step 15). Both require
// a valid role=customer session — see the fake `next/headers` cookie jar helper's header
// comment for why/how session cookies are simulated when invoking route handlers directly.

import "./test-helpers/fake-next-headers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, PATCH } from "@/app/api/account/pets/route";
import { SESSION_COOKIE_NAME } from "@/server/session";
import { __resetServicesForTesting, __setServicesForTesting } from "@/server/container";
import { buildTestServices, type TestServicesBundle } from "./test-helpers/build-test-services";
import { jsonRequest } from "./test-helpers/request";
import { resetFakeCookieJar, seedCookie } from "./test-helpers/fake-next-headers";

const PETS_URL = "http://localhost/api/account/pets";

async function loginAsCustomer(bundle: TestServicesBundle) {
  const { session, identity } = await bundle.auth.registerAccount("jane@example.com", "password123", {
    name: "Jane Doe",
    phone: "555-0100",
    email: "jane@example.com",
  });
  seedCookie(SESSION_COOKIE_NAME, session.id);
  return { session, identity, ownerId: identity.ownerId! };
}

async function loginAsOwner(bundle: TestServicesBundle) {
  const identity = await bundle.repos.auth.createIdentity({
    email: "shop@example.com",
    passwordHash: "irrelevant-hash-not-used-by-login-here",
    role: "owner",
    ownerId: null,
  });
  const session = await bundle.repos.auth.createSession({ authIdentityId: identity.id, role: "owner" });
  seedCookie(SESSION_COOKIE_NAME, session.id);
  return { session, identity };
}

describe("public /api/account/pets routes", () => {
  let bundle: TestServicesBundle;

  beforeEach(async () => {
    bundle = await buildTestServices();
    __setServicesForTesting(bundle.services);
    resetFakeCookieJar();
  });

  afterEach(() => {
    __resetServicesForTesting();
  });

  describe("GET /api/account/pets", () => {
    it("401s with no session cookie at all", async () => {
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("401s for a session that isn't role=customer (e.g. the shop owner)", async () => {
      await loginAsOwner(bundle);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("200s with { owner } (including pets) for a valid customer session — RC-1", async () => {
      const { ownerId } = await loginAsCustomer(bundle);
      await bundle.customer.addPet(ownerId, { name: "Rex", breed: "Labrador", size: "Medium" });

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.owner.id).toBe(ownerId);
      expect(body.owner.pets).toHaveLength(1);
      expect(body.owner.pets[0]).toMatchObject({ name: "Rex", breed: "Labrador", size: "Medium" });
    });
  });

  describe("PATCH /api/account/pets", () => {
    it("401s with no session", async () => {
      const res = await PATCH(jsonRequest(PETS_URL, "PATCH", { name: "Rex", breed: "Labrador", size: "Medium" }));
      expect(res.status).toBe(401);
    });

    it("201s and creates a new pet when no petId is supplied — BR-CUST-5/6", async () => {
      await loginAsCustomer(bundle);

      const res = await PATCH(jsonRequest(PETS_URL, "PATCH", { name: "Rex", breed: "Labrador", size: "Medium", age: 3 }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.pet).toMatchObject({ name: "Rex", breed: "Labrador", size: "Medium", age: 3 });
    });

    it("400s creating a pet with an invalid size", async () => {
      await loginAsCustomer(bundle);
      const res = await PATCH(jsonRequest(PETS_URL, "PATCH", { name: "Rex", breed: "Labrador", size: "Huge" }));
      expect(res.status).toBe(400);
    });

    it("400s creating a pet missing required fields", async () => {
      await loginAsCustomer(bundle);
      const res = await PATCH(jsonRequest(PETS_URL, "PATCH", { name: "Rex" }));
      expect(res.status).toBe(400);
    });

    it("200s and updates an existing pet belonging to the caller when petId is supplied", async () => {
      const { ownerId } = await loginAsCustomer(bundle);
      const pet = await bundle.customer.addPet(ownerId, { name: "Rex", breed: "Labrador", size: "Medium" });

      const res = await PATCH(jsonRequest(PETS_URL, "PATCH", { petId: pet.id, name: "Rex Jr.", temperamentNotes: "Skittish around clippers" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pet).toMatchObject({ id: pet.id, name: "Rex Jr.", temperamentNotes: "Skittish around clippers" });
    });

    it("404s updating a petId that doesn't belong to the caller's own Owner", async () => {
      // A different customer's pet.
      const other = await bundle.customer.createOrFindOwner({ name: "Bob", phone: "555-0200", email: "bob@example.com" });
      const otherPet = await bundle.customer.addPet(other.id, { name: "Fido", breed: "Poodle", size: "Small" });

      await loginAsCustomer(bundle);
      const res = await PATCH(jsonRequest(PETS_URL, "PATCH", { petId: otherPet.id, name: "Hijacked" }));
      expect(res.status).toBe(404);
    });
  });
});
