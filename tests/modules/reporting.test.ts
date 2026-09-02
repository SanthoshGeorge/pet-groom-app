// Unit tests for ReportingService (src/modules/reporting) — Code Generation Step 10.
// Covers every numbered rule in reporting-business-rules.md (BR-REPORT-1..4) — there is
// no separate business-logic-model.md for `reporting` (its business rules doc is the
// whole of its Functional Design pass). Backed by an in-memory fake ReportingRepository
// (tests/fakes/reporting.fake.ts) — no real database involved.

import { beforeEach, describe, expect, it } from "vitest";
import { createReportingService, type ReportingService } from "@/modules/reporting/service";
import { InvalidReportPeriodError } from "@/modules/reporting/errors";
import { createFakeReportingRepository, type FakeReportingRepository } from "../fakes/reporting.fake";

function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Monday of the current UTC calendar week, per BR-REPORT-1's "Monday-Sunday". */
function currentWeekMonday(now: Date): Date {
  const today = startOfUTCDay(now);
  const dayOfWeek = today.getUTCDay(); // 0=Sun .. 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDaysUTC(today, -daysSinceMonday);
}

function firstOfCurrentMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

describe("ReportingService", () => {
  let repository: FakeReportingRepository;
  let service: ReportingService;

  beforeEach(() => {
    repository = createFakeReportingRepository();
    service = createReportingService({ repository });
  });

  describe("BR-REPORT-1 — Preset periods only: exactly ThisWeek and ThisMonth, computed relative to today", () => {
    it("rejects a period value other than the two accepted presets", async () => {
      await expect(service.getAppointmentSummary("ThisYear" as never)).rejects.toBeInstanceOf(InvalidReportPeriodError);
      await expect(service.getAppointmentSummary("" as never)).rejects.toBeInstanceOf(InvalidReportPeriodError);
    });

    it("ThisWeek counts an appointment on today's Monday and excludes one from last week / next week", async () => {
      const now = new Date();
      const monday = currentWeekMonday(now);
      repository._appointments.push(
        { slotStart: new Date(monday.getTime() + 60_000), status: "Booked" }, // just after Monday 00:00 — inside the week
        { slotStart: addDaysUTC(monday, -1), status: "Booked" }, // last Sunday — previous week, excluded
        { slotStart: addDaysUTC(monday, 7), status: "Booked" }, // next Monday — excluded (half-open upper bound)
      );

      const result = await service.getAppointmentSummary("ThisWeek");

      expect(result.totalAppointments).toBe(1);
    });

    it("ThisWeek's range runs Monday through the end of Sunday (inclusive of the whole week)", async () => {
      const now = new Date();
      const monday = currentWeekMonday(now);
      const sundayLateEvening = new Date(addDaysUTC(monday, 6).getTime() + 23 * 60 * 60_000 + 59 * 60_000); // Sunday 23:59
      repository._appointments.push({ slotStart: sundayLateEvening, status: "Booked" });

      const result = await service.getAppointmentSummary("ThisWeek");

      expect(result.totalAppointments).toBe(1);
    });

    it("ThisMonth counts an appointment on the 1st and excludes one on the 1st of next month", async () => {
      const now = new Date();
      const firstOfMonth = firstOfCurrentMonth(now);
      const firstOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      repository._appointments.push(
        { slotStart: new Date(firstOfMonth.getTime() + 60_000), status: "Booked" }, // inside the month
        { slotStart: firstOfNextMonth, status: "Booked" }, // excluded (half-open upper bound)
      );

      const result = await service.getAppointmentSummary("ThisMonth");

      expect(result.totalAppointments).toBe(1);
    });
  });

  describe("BR-REPORT-2 — Appointment total includes every status, including Cancelled", () => {
    it("counts Booked, Completed, Cancelled, and NoShow appointments alike in the total", async () => {
      const now = new Date();
      const monday = currentWeekMonday(now);
      const inWeek = new Date(monday.getTime() + 60_000);
      repository._appointments.push(
        { slotStart: inWeek, status: "Booked" },
        { slotStart: inWeek, status: "Completed" },
        { slotStart: inWeek, status: "Cancelled" },
        { slotStart: inWeek, status: "NoShow" },
      );

      const result = await service.getAppointmentSummary("ThisWeek");

      expect(result.totalAppointments).toBe(4); // every status counted, Cancelled included
    });
  });

  describe("BR-REPORT-3 — No-show count = count(status = NoShow, slotStart in period)", () => {
    it("counts only NoShow appointments toward noShowCount, and only within the period", async () => {
      const now = new Date();
      const monday = currentWeekMonday(now);
      const inWeek = new Date(monday.getTime() + 60_000);
      const lastWeek = addDaysUTC(monday, -1);
      repository._appointments.push(
        { slotStart: inWeek, status: "NoShow" },
        { slotStart: inWeek, status: "NoShow" },
        { slotStart: inWeek, status: "Completed" },
        { slotStart: lastWeek, status: "NoShow" }, // outside the period — excluded
      );

      const result = await service.getAppointmentSummary("ThisWeek");

      expect(result.noShowCount).toBe(2);
      expect(result.totalAppointments).toBe(3);
    });

    it("returns zero counts for a period with no appointments at all", async () => {
      const result = await service.getAppointmentSummary("ThisMonth");
      expect(result).toEqual({ totalAppointments: 0, noShowCount: 0 });
    });
  });

  describe("BR-REPORT-4 — Output shape: exactly { totalAppointments, noShowCount }, no expanded breakdown", () => {
    it("returns only the two documented fields, nothing else (e.g. no revenue breakdown)", async () => {
      const now = new Date();
      const monday = currentWeekMonday(now);
      repository._appointments.push({ slotStart: new Date(monday.getTime() + 60_000), status: "NoShow" });

      const result = await service.getAppointmentSummary("ThisWeek");

      expect(Object.keys(result).sort()).toEqual(["noShowCount", "totalAppointments"]);
    });
  });
});
