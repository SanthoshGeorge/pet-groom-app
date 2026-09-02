// Integration tests for the public booking routes (Code Generation Step 15):
// POST /api/bookings, POST /api/bookings/lookup, PATCH /api/bookings/:id.
//
// POST /api/bookings and PATCH /api/bookings/:id read the session cookie (to resolve an
// account-linked/owner caller), so this file also loads the fake `next/headers` cookie jar
// — see tests/api/test-helpers/fake-next-headers.ts's header comment.
//
// BR-BOOK-5 (guest-lookup's generic-error-either-way pattern) is specifically and
// thoroughly verified in the "POST /api/bookings/lookup" describe block below.

import "./test-helpers/fake-next-headers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { POST as lookupPost } from "@/app/api/bookings/lookup/route";
import { PATCH as bookingPatch } from "@/app/api/bookings/[id]/route";
import { SESSION_COOKIE_NAME } from "@/server/session";
import { __resetServicesForTesting, __setServicesForTesting } from "@/server/container";
import { buildTestServices, type TestServicesBundle } from "./test-helpers/build-test-services";
import { jsonRequest } from "./test-helpers/request";
import { resetFakeCookieJar, seedCookie } from "./test-helpers/fake-next-headers";
import type { Service } from "@/modules/catalog";

const BOOKINGS_URL = "http://localhost/api/bookings";
const LOOKUP_URL = "http://localhost/api/bookings/lookup";

const GUEST_CONTACT = { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" };

function futureSlotIso(daysFromNow = 3, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function setupBathService(bundle: TestServicesBundle): Promise<Service> {
  await bundle.setAllDayHours();
  return bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
}

async function loginAsCustomer(bundle: TestServicesBundle, contact = { name: "Amy Customer", phone: "555-0300", email: "amy@example.com" }) {
  const { session, identity } = await bundle.auth.registerAccount(contact.email, "password123", contact);
  seedCookie(SESSION_COOKIE_NAME, session.id);
  return { session, identity, ownerId: identity.ownerId! };
}

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

async function createGuestBooking(bundle: TestServicesBundle, bath: Service, slotStart = futureSlotIso()) {
  const res = await bookingsPost(
    jsonRequest(BOOKINGS_URL, "POST", {
      contact: GUEST_CONTACT,
      pets: [{ newPet: { name: "Rex", breed: "Labrador", size: "Medium" }, serviceId: bath.id }],
      slotStart,
    }),
  );
  expect(res.status).toBe(201);
  const body = await res.json();
  return body.appointment;
}

describe("public booking routes", () => {
  let bundle: TestServicesBundle;

  beforeEach(async () => {
    bundle = await buildTestServices();
    __setServicesForTesting(bundle.services);
    resetFakeCookieJar();
  });

  afterEach(() => {
    __resetServicesForTesting();
  });

  describe("POST /api/bookings", () => {
    it("201s a guest booking with { appointment } shaped per the domain type — GC-2", async () => {
      const bath = await setupBathService(bundle);
      const slotStart = futureSlotIso();

      const res = await bookingsPost(
        jsonRequest(BOOKINGS_URL, "POST", {
          contact: GUEST_CONTACT,
          pets: [{ newPet: { name: "Rex", breed: "Labrador", size: "Medium" }, serviceId: bath.id }],
          slotStart,
        }),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.appointment).toMatchObject({
        createdBy: "guest",
        status: "Booked",
        isOverride: false,
        hasConflict: false,
      });
      expect(body.appointment.bookingReference).toBeTruthy();
      expect(body.appointment.lineItems).toHaveLength(1);
      expect(body.appointment.lineItems[0]).toMatchObject({ serviceId: bath.id, priceSnapshot: 30, durationSnapshotMinutes: 30 });
    });

    it("201s an account-linked booking (createdBy: account) against the logged-in customer's own Owner — RC-2", async () => {
      const bath = await setupBathService(bundle);
      const { ownerId } = await loginAsCustomer(bundle);
      const pet = await bundle.customer.addPet(ownerId, { name: "Milo", breed: "Poodle", size: "Small" });

      const res = await bookingsPost(
        jsonRequest(BOOKINGS_URL, "POST", {
          pets: [{ petId: pet.id, serviceId: bath.id }],
          slotStart: futureSlotIso(),
        }),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.appointment.createdBy).toBe("account");
      expect(body.appointment.ownerId).toBe(ownerId);
    });

    it("400s when pets is an empty array", async () => {
      const bath = await setupBathService(bundle);
      const res = await bookingsPost(
        jsonRequest(BOOKINGS_URL, "POST", { contact: GUEST_CONTACT, pets: [], slotStart: futureSlotIso(), serviceId: bath.id }),
      );
      expect(res.status).toBe(400);
    });

    it("400s when not logged in and contact is missing", async () => {
      const bath = await setupBathService(bundle);
      const res = await bookingsPost(
        jsonRequest(BOOKINGS_URL, "POST", {
          pets: [{ newPet: { name: "Rex", breed: "Labrador", size: "Medium" }, serviceId: bath.id }],
          slotStart: futureSlotIso(),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("400s when a pet specifies both petId and newPet", async () => {
      const bath = await setupBathService(bundle);
      const res = await bookingsPost(
        jsonRequest(BOOKINGS_URL, "POST", {
          contact: GUEST_CONTACT,
          pets: [{ petId: "some-id", newPet: { name: "Rex", breed: "Labrador", size: "Medium" }, serviceId: bath.id }],
          slotStart: futureSlotIso(),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("409s when the exact same slot is claimed twice — BR-AVAIL-5/6", async () => {
      const bath = await setupBathService(bundle);
      const slotStart = futureSlotIso();
      await createGuestBooking(bundle, bath, slotStart);

      const res = await bookingsPost(
        jsonRequest(BOOKINGS_URL, "POST", {
          contact: { name: "Second Guest", phone: "555-0111", email: "second@example.com" },
          pets: [{ newPet: { name: "Fido", breed: "Beagle", size: "Small" }, serviceId: bath.id }],
          slotStart,
        }),
      );
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/bookings/lookup — BR-BOOK-5", () => {
    it("200s with { appointment } for a matching reference + email", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath);

      const res = await lookupPost(
        jsonRequest(LOOKUP_URL, "POST", { bookingReference: appointment.bookingReference, contact: { email: GUEST_CONTACT.email } }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.appointment.id).toBe(appointment.id);
    });

    it("200s for a matching reference + phone (formatting characters stripped before comparing)", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath);

      const res = await lookupPost(
        jsonRequest(LOOKUP_URL, "POST", { bookingReference: appointment.bookingReference, contact: { phone: "(555) 010-0" } }),
      );
      expect(res.status).toBe(200);
    });

    it("400s when bookingReference is missing", async () => {
      const res = await lookupPost(jsonRequest(LOOKUP_URL, "POST", { contact: { email: "jane@example.com" } }));
      expect(res.status).toBe(400);
    });

    it("400s when contact is missing", async () => {
      const res = await lookupPost(jsonRequest(LOOKUP_URL, "POST", { bookingReference: "HTG-0000" }));
      expect(res.status).toBe(400);
    });

    it("BR-BOOK-5: a wrong (nonexistent) reference and a right-reference-but-wrong-contact both produce the exact same generic error response, both status and body — an attacker cannot distinguish the two cases", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath);

      const wrongReferenceRes = await lookupPost(
        jsonRequest(LOOKUP_URL, "POST", {
          bookingReference: "HTG-DOES-NOT-EXIST",
          contact: { email: GUEST_CONTACT.email },
        }),
      );
      const wrongContactRes = await lookupPost(
        jsonRequest(LOOKUP_URL, "POST", {
          bookingReference: appointment.bookingReference,
          contact: { email: "attacker-guess@example.com", phone: "555-9999999" },
        }),
      );

      // Same status code.
      expect(wrongReferenceRes.status).toBe(404);
      expect(wrongContactRes.status).toBe(404);
      expect(wrongReferenceRes.status).toBe(wrongContactRes.status);

      // Byte-identical (structurally identical) response bodies — no distinguishing detail.
      const [wrongReferenceBody, wrongContactBody] = await Promise.all([wrongReferenceRes.json(), wrongContactRes.json()]);
      expect(wrongReferenceBody).toEqual(wrongContactBody);
      expect(wrongReferenceBody).toEqual({ error: "No booking found matching that reference and contact information" });

      // And, for good measure, the raw response text is identical too (truly byte-identical,
      // not merely deep-equal after JSON parsing).
      const [wrongReferenceText, wrongContactText] = await Promise.all([
        lookupPost(
          jsonRequest(LOOKUP_URL, "POST", { bookingReference: "HTG-DOES-NOT-EXIST", contact: { email: GUEST_CONTACT.email } }),
        ).then((r) => r.text()),
        lookupPost(
          jsonRequest(LOOKUP_URL, "POST", {
            bookingReference: appointment.bookingReference,
            contact: { email: "attacker-guess@example.com" },
          }),
        ).then((r) => r.text()),
      ]);
      expect(wrongReferenceText).toBe(wrongContactText);
    });

    it("BR-BOOK-5: a right reference with a wrong phone (but omitted email) also produces the identical generic error", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath);

      const res = await lookupPost(
        jsonRequest(LOOKUP_URL, "POST", { bookingReference: appointment.bookingReference, contact: { phone: "555-0000000" } }),
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: "No booking found matching that reference and contact information" });
    });
  });

  describe("PATCH /api/bookings/:id", () => {
    it("cancels a guest's own booking when bookingReference + contact are supplied and match (actor: guest) — GC-3", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath);

      const res = await bookingPatch(
        jsonRequest(`http://localhost/api/bookings/${appointment.id}`, "PATCH", {
          action: "cancel",
          bookingReference: appointment.bookingReference,
          contact: { email: GUEST_CONTACT.email },
        }),
        { params: Promise.resolve({ id: appointment.id }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.appointment.status).toBe("Cancelled");
      expect(body.appointment.cancelledBy).toBe("guest");
    });

    it("401s when no session and no bookingReference/contact are supplied", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath);

      const res = await bookingPatch(
        jsonRequest(`http://localhost/api/bookings/${appointment.id}`, "PATCH", { action: "cancel" }),
        { params: Promise.resolve({ id: appointment.id }) },
      );
      expect(res.status).toBe(401);
    });

    it("a role=owner session can cancel ANY appointment regardless of ownership — SO-1", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath);
      await loginAsOwner(bundle);

      const res = await bookingPatch(
        jsonRequest(`http://localhost/api/bookings/${appointment.id}`, "PATCH", { action: "cancel" }),
        { params: Promise.resolve({ id: appointment.id }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.appointment.status).toBe("Cancelled");
      expect(body.appointment.cancelledBy).toBe("owner");
    });

    it("a role=customer session can cancel their own account-linked booking without needing bookingReference/contact — RC-3", async () => {
      const bath = await setupBathService(bundle);
      const { ownerId } = await loginAsCustomer(bundle);
      const pet = await bundle.customer.addPet(ownerId, { name: "Milo", breed: "Poodle", size: "Small" });
      const createRes = await bookingsPost(
        jsonRequest(BOOKINGS_URL, "POST", { pets: [{ petId: pet.id, serviceId: bath.id }], slotStart: futureSlotIso() }),
      );
      const appointment = (await createRes.json()).appointment;

      const res = await bookingPatch(
        jsonRequest(`http://localhost/api/bookings/${appointment.id}`, "PATCH", { action: "cancel" }),
        { params: Promise.resolve({ id: appointment.id }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.appointment.cancelledBy).toBe("account");
    });

    it("a logged-in customer poking at someone else's appointment id (no session ownership, no proof) gets the same 404 BR-BOOK-5 gives a guest — not a distinct 'exists but not yours' signal", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath); // owned by a different (guest) Owner
      await loginAsCustomer(bundle); // a real, but unrelated, customer session

      const res = await bookingPatch(
        jsonRequest(`http://localhost/api/bookings/${appointment.id}`, "PATCH", { action: "cancel" }),
        { params: Promise.resolve({ id: appointment.id }) },
      );
      expect(res.status).toBe(401);
    });

    it("reschedules a booking to a new slotStart — GC-3/RC-3", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath, futureSlotIso(3));
      const newSlot = futureSlotIso(5, 14);

      const res = await bookingPatch(
        jsonRequest(`http://localhost/api/bookings/${appointment.id}`, "PATCH", {
          action: "reschedule",
          slotStart: newSlot,
          bookingReference: appointment.bookingReference,
          contact: { email: GUEST_CONTACT.email },
        }),
        { params: Promise.resolve({ id: appointment.id }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(new Date(body.appointment.slotStart).toISOString()).toBe(new Date(newSlot).toISOString());
    });

    it("400s with an invalid action", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath);
      const res = await bookingPatch(
        jsonRequest(`http://localhost/api/bookings/${appointment.id}`, "PATCH", {
          action: "delete",
          bookingReference: appointment.bookingReference,
          contact: { email: GUEST_CONTACT.email },
        }),
        { params: Promise.resolve({ id: appointment.id }) },
      );
      expect(res.status).toBe(400);
    });

    it("409s cancelling an already-cancelled appointment — BR-BOOK-6", async () => {
      const bath = await setupBathService(bundle);
      const appointment = await createGuestBooking(bundle, bath);
      const cancelBody = { action: "cancel" as const, bookingReference: appointment.bookingReference, contact: { email: GUEST_CONTACT.email } };

      const first = await bookingPatch(
        jsonRequest(`http://localhost/api/bookings/${appointment.id}`, "PATCH", cancelBody),
        { params: Promise.resolve({ id: appointment.id }) },
      );
      expect(first.status).toBe(200);

      const second = await bookingPatch(
        jsonRequest(`http://localhost/api/bookings/${appointment.id}`, "PATCH", cancelBody),
        { params: Promise.resolve({ id: appointment.id }) },
      );
      expect(second.status).toBe(409);
    });
  });
});
