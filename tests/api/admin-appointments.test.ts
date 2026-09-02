// Integration tests for the admin calendar/booking-on-behalf/no-show routes (Code
// Generation Step 15): GET /api/admin/appointments, POST /api/admin/bookings,
// POST /api/admin/appointments/:id/no-show — all owner-gated via
// `requireOwnerSession` (src/server/session.ts).
//
// Auth-gating shape asserted on every route below, per the Step 15 task's explicit call-
// out: no session -> 401, a real but non-owner (role=customer) session -> 403, a valid
// owner session -> success. Uses the fake `next/headers` cookie jar since every route here
// reads the session cookie.

import "./test-helpers/fake-next-headers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as appointmentsGet } from "@/app/api/admin/appointments/route";
import { POST as adminBookingsPost } from "@/app/api/admin/bookings/route";
import { POST as noShowPost } from "@/app/api/admin/appointments/[id]/no-show/route";
import { SESSION_COOKIE_NAME } from "@/server/session";
import { __resetServicesForTesting, __setServicesForTesting } from "@/server/container";
import { buildTestServices, type TestServicesBundle } from "./test-helpers/build-test-services";
import { jsonRequest, nextGetRequest } from "./test-helpers/request";
import { resetFakeCookieJar, seedCookie } from "./test-helpers/fake-next-headers";
import type { Service } from "@/modules/catalog";

const APPOINTMENTS_URL = "http://localhost/api/admin/appointments";
const ADMIN_BOOKINGS_URL = "http://localhost/api/admin/bookings";

function futureSlotIso(daysFromNow = 3, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function pastSlotIso(daysAgo = 1, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function setupBathService(bundle: TestServicesBundle): Promise<Service> {
  await bundle.setAllDayHours();
  return bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
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
}

async function loginAsCustomer(bundle: TestServicesBundle) {
  const { session } = await bundle.auth.registerAccount("jane@example.com", "password123", {
    name: "Jane Doe",
    phone: "555-0100",
    email: "jane@example.com",
  });
  seedCookie(SESSION_COOKIE_NAME, session.id);
}

describe("admin appointments / on-behalf-booking / no-show routes", () => {
  let bundle: TestServicesBundle;

  beforeEach(async () => {
    bundle = await buildTestServices();
    __setServicesForTesting(bundle.services);
    resetFakeCookieJar();
  });

  afterEach(() => {
    __resetServicesForTesting();
  });

  describe("GET /api/admin/appointments", () => {
    it("401s with no session cookie at all", async () => {
      const res = await appointmentsGet(nextGetRequest(`${APPOINTMENTS_URL}?start=2026-01-01&end=2026-02-01`));
      expect(res.status).toBe(401);
    });

    it("403s for a real but non-owner (role=customer) session", async () => {
      await loginAsCustomer(bundle);
      const res = await appointmentsGet(nextGetRequest(`${APPOINTMENTS_URL}?start=2026-01-01&end=2026-02-01`));
      expect(res.status).toBe(403);
    });

    it("200s with { appointments } for a valid owner session — SO-1 admin calendar", async () => {
      const bath = await setupBathService(bundle);
      const slotStart = futureSlotIso();
      await bundle.booking.createBooking({
        owner: { kind: "contact", contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" } },
        petServicePairs: [{ pet: { kind: "newPet", details: { name: "Rex", breed: "Labrador", size: "Medium" } }, serviceId: bath.id }],
        slotStart: new Date(slotStart),
        createdBy: "guest",
      });
      await loginAsOwner(bundle);

      const start = new Date();
      start.setDate(start.getDate());
      const end = new Date();
      end.setDate(end.getDate() + 10);

      const res = await appointmentsGet(nextGetRequest(`${APPOINTMENTS_URL}?start=${start.toISOString()}&end=${end.toISOString()}`));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.appointments)).toBe(true);
      expect(body.appointments).toHaveLength(1);
    });

    it("400s when start or end is missing", async () => {
      await loginAsOwner(bundle);
      const res = await appointmentsGet(nextGetRequest(`${APPOINTMENTS_URL}?start=2026-01-01`));
      expect(res.status).toBe(400);
    });

    it("400s when start/end isn't a valid date", async () => {
      await loginAsOwner(bundle);
      const res = await appointmentsGet(nextGetRequest(`${APPOINTMENTS_URL}?start=not-a-date&end=2026-02-01`));
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/admin/bookings — SO-3 (owner booking on behalf of a customer, override variant)", () => {
    it("401s with no session cookie at all", async () => {
      const bath = await setupBathService(bundle);
      const res = await adminBookingsPost(
        jsonRequest(ADMIN_BOOKINGS_URL, "POST", {
          contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" },
          pets: [{ newPet: { name: "Rex", breed: "Labrador", size: "Medium" }, serviceId: bath.id }],
          slotStart: futureSlotIso(),
        }),
      );
      expect(res.status).toBe(401);
    });

    it("403s for a role=customer session", async () => {
      const bath = await setupBathService(bundle);
      await loginAsCustomer(bundle);
      const res = await adminBookingsPost(
        jsonRequest(ADMIN_BOOKINGS_URL, "POST", {
          contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" },
          pets: [{ newPet: { name: "Rex", breed: "Labrador", size: "Medium" }, serviceId: bath.id }],
          slotStart: futureSlotIso(),
        }),
      );
      expect(res.status).toBe(403);
    });

    it("201s with { appointment } (createdBy: owner) for a valid owner session, using a fresh contact", async () => {
      const bath = await setupBathService(bundle);
      await loginAsOwner(bundle);

      const res = await adminBookingsPost(
        jsonRequest(ADMIN_BOOKINGS_URL, "POST", {
          contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" },
          pets: [{ newPet: { name: "Rex", breed: "Labrador", size: "Medium" }, serviceId: bath.id }],
          slotStart: futureSlotIso(),
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.appointment).toMatchObject({ createdBy: "owner", status: "Booked" });
    });

    it("201s and sets isOverride/hasConflict when the slot is genuinely outside hours (SO-3, BR-AVAIL-10)", async () => {
      // Deliberately closed hours (never call setAllDayHours) — any slot is "outside hours."
      const bath = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      await loginAsOwner(bundle);

      const res = await adminBookingsPost(
        jsonRequest(ADMIN_BOOKINGS_URL, "POST", {
          contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" },
          pets: [{ newPet: { name: "Rex", breed: "Labrador", size: "Medium" }, serviceId: bath.id }],
          slotStart: futureSlotIso(),
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.appointment.isOverride).toBe(true);
    });

    it("201s booking against an existing owner via ownerId", async () => {
      const bath = await setupBathService(bundle);
      const existingOwner = await bundle.customer.createOrFindOwner({ name: "Bob", phone: "555-0200", email: "bob@example.com" });
      await loginAsOwner(bundle);

      const res = await adminBookingsPost(
        jsonRequest(ADMIN_BOOKINGS_URL, "POST", {
          ownerId: existingOwner.id,
          pets: [{ newPet: { name: "Fido", breed: "Poodle", size: "Small" }, serviceId: bath.id }],
          slotStart: futureSlotIso(),
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.appointment.ownerId).toBe(existingOwner.id);
    });

    it("400s when both ownerId and contact are supplied", async () => {
      const bath = await setupBathService(bundle);
      await loginAsOwner(bundle);
      const res = await adminBookingsPost(
        jsonRequest(ADMIN_BOOKINGS_URL, "POST", {
          ownerId: "some-id",
          contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" },
          pets: [{ newPet: { name: "Rex", breed: "Labrador", size: "Medium" }, serviceId: bath.id }],
          slotStart: futureSlotIso(),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("400s when neither ownerId nor contact is supplied", async () => {
      const bath = await setupBathService(bundle);
      await loginAsOwner(bundle);
      const res = await adminBookingsPost(
        jsonRequest(ADMIN_BOOKINGS_URL, "POST", {
          pets: [{ newPet: { name: "Rex", breed: "Labrador", size: "Medium" }, serviceId: bath.id }],
          slotStart: futureSlotIso(),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("400s when pets is empty", async () => {
      await loginAsOwner(bundle);
      const res = await adminBookingsPost(
        jsonRequest(ADMIN_BOOKINGS_URL, "POST", {
          contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" },
          pets: [],
          slotStart: futureSlotIso(),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("400s on malformed JSON body", async () => {
      await loginAsOwner(bundle);
      const res = await adminBookingsPost(
        // Missing body entirely still exercises readJsonBody's malformed-JSON 400 path.
        new Request(ADMIN_BOOKINGS_URL, { method: "POST", headers: { "content-type": "application/json" }, body: "{not valid json" }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/admin/appointments/:id/no-show — Flow 7, BR-BOOK-2b", () => {
    async function createPastAppointment(bundle: TestServicesBundle, bath: Service) {
      // createOverrideBooking bypasses hours/buffer checks so a past slotStart can still
      // be claimed — the resulting appointment's slotEnd has already passed, so its
      // effective status reads as "Completed" (BR-BOOK-2), eligible for markNoShow.
      return bundle.booking.createOverrideBooking({
        owner: { kind: "contact", contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" } },
        petServicePairs: [{ pet: { kind: "newPet", details: { name: "Rex", breed: "Labrador", size: "Medium" } }, serviceId: bath.id }],
        slotStart: new Date(pastSlotIso()),
        createdBy: "owner",
      });
    }

    it("401s with no session cookie at all", async () => {
      const res = await noShowPost(new Request(`${APPOINTMENTS_URL}/some-id/no-show`, { method: "POST" }), {
        params: Promise.resolve({ id: "some-id" }),
      });
      expect(res.status).toBe(401);
    });

    it("403s for a role=customer session", async () => {
      await loginAsCustomer(bundle);
      const res = await noShowPost(new Request(`${APPOINTMENTS_URL}/some-id/no-show`, { method: "POST" }), {
        params: Promise.resolve({ id: "some-id" }),
      });
      expect(res.status).toBe(403);
    });

    it("200s and marks a past-due (effectively Completed) appointment NoShow for a valid owner session", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createPastAppointment(bundle, bath);
      await loginAsOwner(bundle);

      const res = await noShowPost(new Request(`${APPOINTMENTS_URL}/${appointment.id}/no-show`, { method: "POST" }), {
        params: Promise.resolve({ id: appointment.id }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.appointment.status).toBe("NoShow");
    });

    it("404s for an unknown appointment id", async () => {
      await loginAsOwner(bundle);
      const res = await noShowPost(new Request(`${APPOINTMENTS_URL}/does-not-exist/no-show`, { method: "POST" }), {
        params: Promise.resolve({ id: "does-not-exist" }),
      });
      expect(res.status).toBe(404);
    });

    it("409s marking a still-Booked (not yet due) appointment as NoShow — BR-BOOK-2b", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await bundle.booking.createBooking({
        owner: { kind: "contact", contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" } },
        petServicePairs: [{ pet: { kind: "newPet", details: { name: "Rex", breed: "Labrador", size: "Medium" } }, serviceId: bath.id }],
        slotStart: new Date(futureSlotIso()),
        createdBy: "guest",
      });
      await loginAsOwner(bundle);

      const res = await noShowPost(new Request(`${APPOINTMENTS_URL}/${appointment.id}/no-show`, { method: "POST" }), {
        params: Promise.resolve({ id: appointment.id }),
      });
      expect(res.status).toBe(409);
    });
  });
});
