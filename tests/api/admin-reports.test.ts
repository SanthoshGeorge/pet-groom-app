// Integration tests for GET /api/admin/reports (Code Generation Step 15) — SO-6,
// BR-REPORT-1..4, owner-gated via `requireOwnerSession`.

import "./test-helpers/fake-next-headers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as reportsGet } from "@/app/api/admin/reports/route";
import { SESSION_COOKIE_NAME } from "@/server/session";
import { __resetServicesForTesting, __setServicesForTesting } from "@/server/container";
import { buildTestServices, type TestServicesBundle } from "./test-helpers/build-test-services";
import { nextGetRequest } from "./test-helpers/request";
import { resetFakeCookieJar, seedCookie } from "./test-helpers/fake-next-headers";

const REPORTS_URL = "http://localhost/api/admin/reports";

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

describe("GET /api/admin/reports", () => {
  let bundle: TestServicesBundle;

  beforeEach(async () => {
    bundle = await buildTestServices();
    __setServicesForTesting(bundle.services);
    resetFakeCookieJar();
  });

  afterEach(() => {
    __resetServicesForTesting();
  });

  it("401s with no session cookie at all", async () => {
    const res = await reportsGet(nextGetRequest(`${REPORTS_URL}?period=ThisWeek`));
    expect(res.status).toBe(401);
  });

  it("403s for a role=customer session", async () => {
    await loginAsCustomer(bundle);
    const res = await reportsGet(nextGetRequest(`${REPORTS_URL}?period=ThisWeek`));
    expect(res.status).toBe(403);
  });

  it("200s with { summary: { totalAppointments, noShowCount } } for period=ThisWeek — BR-REPORT-2/3/4", async () => {
    const now = new Date();
    // Two in-range appointments (one a no-show), one clearly out of range.
    bundle.repos.reporting._appointments.push(
      { slotStart: now, status: "Booked" },
      { slotStart: now, status: "NoShow" },
      { slotStart: new Date(now.getFullYear() - 1, 0, 1), status: "Completed" },
    );
    await loginAsOwner(bundle);

    const res = await reportsGet(nextGetRequest(`${REPORTS_URL}?period=ThisWeek`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toEqual({ totalAppointments: 2, noShowCount: 1 });
  });

  it("200s for period=ThisMonth too", async () => {
    await loginAsOwner(bundle);
    const res = await reportsGet(nextGetRequest(`${REPORTS_URL}?period=ThisMonth`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toEqual({ totalAppointments: 0, noShowCount: 0 });
  });

  it("400s when period is missing", async () => {
    await loginAsOwner(bundle);
    const res = await reportsGet(nextGetRequest(REPORTS_URL));
    expect(res.status).toBe(400);
  });

  it("400s for an unrecognized period value — BR-REPORT-1", async () => {
    await loginAsOwner(bundle);
    const res = await reportsGet(nextGetRequest(`${REPORTS_URL}?period=LastYear`));
    expect(res.status).toBe(400);
  });
});
