// Integration tests for POST /api/cron/reminders (Code Generation Step 15) — the
// cron-triggered daily reminder batch job (Flow 3 of notification-business-logic-model.md,
// BR-NOTIF-1/3/4). Machine-to-machine: no session cookie, gated entirely by the
// `Authorization: Bearer <CRON_SECRET>` shared-secret header the route checks against
// `process.env.CRON_SECRET` (see src/app/api/cron/reminders/route.ts's header comment for
// why this exact header/scheme was chosen — it's what Vercel Cron sends automatically).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as remindersPost } from "@/app/api/cron/reminders/route";
import { __resetServicesForTesting, __setServicesForTesting } from "@/server/container";
import { buildTestServices, type TestServicesBundle } from "./test-helpers/build-test-services";
import type { Service } from "@/modules/catalog";

const CRON_URL = "http://localhost/api/cron/reminders";
const TEST_SECRET = "test-cron-secret";

function requestWithAuth(header: string | null): Request {
  return new Request(CRON_URL, {
    method: "POST",
    headers: header !== null ? { authorization: header } : {},
  });
}

async function setupBathService(bundle: TestServicesBundle): Promise<Service> {
  await bundle.setAllDayHours();
  return bundle.catalog.createService({ name: "Bath", price: 30, durationMinutes: 30 });
}

function futureSlotIso(daysFromNow = 3, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

describe("POST /api/cron/reminders", () => {
  let bundle: TestServicesBundle;
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(async () => {
    bundle = await buildTestServices();
    __setServicesForTesting(bundle.services);
    process.env.CRON_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    __resetServicesForTesting();
    process.env.CRON_SECRET = originalSecret;
  });

  it("401s when the Authorization header is missing entirely", async () => {
    const res = await remindersPost(requestWithAuth(null));
    expect(res.status).toBe(401);
  });

  it("401s when the Authorization header carries the wrong secret", async () => {
    const res = await remindersPost(requestWithAuth("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("401s when the header uses the wrong scheme (bare secret, no Bearer prefix)", async () => {
    const res = await remindersPost(requestWithAuth(TEST_SECRET));
    expect(res.status).toBe(401);
  });

  it("401s when CRON_SECRET itself is not configured, even with a header present", async () => {
    delete process.env.CRON_SECRET;
    const res = await remindersPost(requestWithAuth(`Bearer ${TEST_SECRET}`));
    expect(res.status).toBe(401);
  });

  it("200s with { result } and actually runs the daily reminder batch for the correct CRON_SECRET", async () => {
    const bath = await setupBathService(bundle);
    const appointment = await bundle.booking.createBooking({
      owner: { kind: "contact", contact: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" } },
      petServicePairs: [{ pet: { kind: "newPet", details: { name: "Rex", breed: "Labrador", size: "Medium" } }, serviceId: bath.id }],
      slotStart: new Date(futureSlotIso()),
      createdBy: "guest",
    });

    // Seed one due (Pending, sendAt in the past) reminder directly on the fake repository —
    // bypassing scheduleReminder's own fixed-daily-time/short-notice logic (already covered
    // by tests/modules/notification.test.ts) since this route's own concern is just
    // "invokes the batch correctly for a valid secret," not re-testing BR-NOTIF-1/2.
    await bundle.repos.notification.createScheduledReminder({
      appointmentId: appointment.id,
      sendAt: new Date(Date.now() - 60_000),
    });

    // createBooking above already sent one immediate booking-confirmation email
    // (BR-NOTIF-3) — capture that baseline so this assertion isolates the batch's own send.
    const emailsBeforeBatch = bundle.emailSender.sent.length;

    const res = await remindersPost(requestWithAuth(`Bearer ${TEST_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toEqual({ processed: 1, sent: 1, failedCount: 0 });

    // The batch actually invoked the real NotificationService -> real EmailSender path.
    expect(bundle.emailSender.sent).toHaveLength(emailsBeforeBatch + 1);
    // And marked the due reminder Sent (not left Pending) on the underlying repository.
    // (createBooking's own Flow 2 also scheduled a separate, not-yet-due reminder for this
    // same appointment — see notification-business-logic-model.md's Flow 2 — so the store
    // holds two rows in total; only the one this test explicitly seeded as due is Sent.)
    const reminders = [...bundle.repos.notification._reminders.values()];
    expect(reminders.filter((r) => r.status === "Sent")).toHaveLength(1);
    expect(reminders.filter((r) => r.status === "Pending")).toHaveLength(1);
  });

  it("200s with a zero-processed result when no reminders are due for the correct secret", async () => {
    const res = await remindersPost(requestWithAuth(`Bearer ${TEST_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toEqual({ processed: 0, sent: 0, failedCount: 0 });
  });
});
