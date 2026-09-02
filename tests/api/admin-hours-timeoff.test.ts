// Integration tests for the admin working-hours / time-off routes (Code Generation Step
// 15): POST /api/admin/hours, POST /api/admin/time-off — SO-5, owner-gated via
// `requireOwnerSession`. Both also verify the BR-AVAIL-9 cross-module wiring: the route
// passes `affectedAppointmentIds` on to `booking.flagAppointmentsForReview`.

import "./test-helpers/fake-next-headers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as setHoursPost } from "@/app/api/admin/hours/route";
import { POST as addTimeOffPost } from "@/app/api/admin/time-off/route";
import { SESSION_COOKIE_NAME } from "@/server/session";
import { __resetServicesForTesting, __setServicesForTesting } from "@/server/container";
import { buildTestServices, type TestServicesBundle } from "./test-helpers/build-test-services";
import { everydayOpenSchedule } from "../fakes/availability.fake";
import { jsonRequest } from "./test-helpers/request";
import { resetFakeCookieJar, seedCookie } from "./test-helpers/fake-next-headers";
import type { Service } from "@/modules/catalog";

const HOURS_URL = "http://localhost/api/admin/hours";
const TIME_OFF_URL = "http://localhost/api/admin/time-off";

function futureSlotIso(daysFromNow = 3, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
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

async function loginAsCustomer(bundle: TestServicesBundle) {
  const { session } = await bundle.auth.registerAccount("jane@example.com", "password123", {
    name: "Jane Doe",
    phone: "555-0100",
    email: "jane@example.com",
  });
  seedCookie(SESSION_COOKIE_NAME, session.id);
}

describe("admin hours / time-off routes", () => {
  let bundle: TestServicesBundle;

  beforeEach(async () => {
    bundle = await buildTestServices();
    __setServicesForTesting(bundle.services);
    resetFakeCookieJar();
  });

  afterEach(() => {
    __resetServicesForTesting();
  });

  describe("POST /api/admin/hours — SO-5, Flow 5", () => {
    it("401s with no session cookie at all", async () => {
      const res = await setHoursPost(jsonRequest(HOURS_URL, "POST", { schedule: everydayOpenSchedule("09:00", "17:00") }));
      expect(res.status).toBe(401);
    });

    it("403s for a role=customer session", async () => {
      await loginAsCustomer(bundle);
      const res = await setHoursPost(jsonRequest(HOURS_URL, "POST", { schedule: everydayOpenSchedule("09:00", "17:00") }));
      expect(res.status).toBe(403);
    });

    it("200s with { workingHours, affectedAppointmentIds } for a valid owner session — BR-AVAIL-7", async () => {
      await loginAsOwner(bundle);
      const res = await setHoursPost(jsonRequest(HOURS_URL, "POST", { schedule: everydayOpenSchedule("09:00", "17:00") }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.workingHours).toHaveLength(7);
      expect(Array.isArray(body.affectedAppointmentIds)).toBe(true);
    });

    it("400s when schedule is missing/empty", async () => {
      await loginAsOwner(bundle);
      const res = await setHoursPost(jsonRequest(HOURS_URL, "POST", {}));
      expect(res.status).toBe(400);
    });

    it("400s when schedule doesn't cover all 7 days — BR-AVAIL-7 (enforced by the module, surfaced as 400)", async () => {
      await loginAsOwner(bundle);
      const partial = everydayOpenSchedule("09:00", "17:00").slice(0, 3);
      const res = await setHoursPost(jsonRequest(HOURS_URL, "POST", { schedule: partial }));
      expect(res.status).toBe(400);
    });

    it("narrowing hours flags a now-uncovered future appointment for review — BR-AVAIL-9", async () => {
      await bundle.setAllDayHours();
      const bath: Service = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const lateSlot = futureSlotIso(3, 22); // 22:00, will fall outside a 09:00-17:00 schedule
      const appointment = await bundle.booking.createBooking({
        owner: { kind: "contact", contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" } },
        petServicePairs: [{ pet: { kind: "newPet", details: { name: "Rex", breed: "Labrador", size: "Medium" } }, serviceId: bath.id }],
        slotStart: new Date(lateSlot),
        createdBy: "guest",
      });

      await loginAsOwner(bundle);
      const res = await setHoursPost(jsonRequest(HOURS_URL, "POST", { schedule: everydayOpenSchedule("09:00", "17:00") }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.affectedAppointmentIds).toContain(appointment.id);

      // BR-AVAIL-9 cross-module wiring: booking.flagAppointmentsForReview was actually called.
      const flagged = await bundle.repos.booking._appointments.get(appointment.id);
      expect(flagged?.flaggedForReview).toBe(true);
    });
  });

  describe("POST /api/admin/time-off — SO-5, Flow 6", () => {
    it("401s with no session cookie at all", async () => {
      const res = await addTimeOffPost(
        jsonRequest(TIME_OFF_URL, "POST", { startDate: futureSlotIso(10), endDate: futureSlotIso(10) }),
      );
      expect(res.status).toBe(401);
    });

    it("403s for a role=customer session", async () => {
      await loginAsCustomer(bundle);
      const res = await addTimeOffPost(
        jsonRequest(TIME_OFF_URL, "POST", { startDate: futureSlotIso(10), endDate: futureSlotIso(10) }),
      );
      expect(res.status).toBe(403);
    });

    it("201s with { timeOff, affectedAppointmentIds } for a valid owner session — BR-AVAIL-8", async () => {
      await loginAsOwner(bundle);
      const res = await addTimeOffPost(
        jsonRequest(TIME_OFF_URL, "POST", { startDate: futureSlotIso(10), endDate: futureSlotIso(11), reason: "Holiday" }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.timeOff).toMatchObject({ reason: "Holiday" });
      expect(Array.isArray(body.affectedAppointmentIds)).toBe(true);
    });

    it("400s when startDate is missing", async () => {
      await loginAsOwner(bundle);
      const res = await addTimeOffPost(jsonRequest(TIME_OFF_URL, "POST", { endDate: futureSlotIso(10) }));
      expect(res.status).toBe(400);
    });

    it("400s when startDate/endDate isn't a valid date", async () => {
      await loginAsOwner(bundle);
      const res = await addTimeOffPost(jsonRequest(TIME_OFF_URL, "POST", { startDate: "not-a-date", endDate: futureSlotIso(10) }));
      expect(res.status).toBe(400);
    });

    it("time off over an existing booked slot flags the appointment for review — BR-AVAIL-9", async () => {
      await bundle.setAllDayHours();
      const bath: Service = await bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
      const slotStart = futureSlotIso(10);
      const appointment = await bundle.booking.createBooking({
        owner: { kind: "contact", contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" } },
        petServicePairs: [{ pet: { kind: "newPet", details: { name: "Rex", breed: "Labrador", size: "Medium" } }, serviceId: bath.id }],
        slotStart: new Date(slotStart),
        createdBy: "guest",
      });

      await loginAsOwner(bundle);
      const res = await addTimeOffPost(
        jsonRequest(TIME_OFF_URL, "POST", { startDate: futureSlotIso(10), endDate: futureSlotIso(10) }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.affectedAppointmentIds).toContain(appointment.id);

      const flagged = await bundle.repos.booking._appointments.get(appointment.id);
      expect(flagged?.flaggedForReview).toBe(true);
    });
  });
});
