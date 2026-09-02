// ReportingService business logic — implements BR-REPORT-1..4 (reporting-business-rules.md).
// Pure TypeScript: depends only on the ReportingRepository abstraction.

import type { ReportingRepository } from "./repository";
import { currentMonthRange, currentWeekRange } from "./time";
import type { AppointmentSummary, ReportPeriod } from "./types";
import { validateReportPeriod } from "./validation";

export interface ReportingServiceDependencies {
  repository: ReportingRepository;
}

export interface ReportingService {
  /** BR-REPORT-1..4 — SO-6's admin reports view. Signature matches component-methods.md's `getAppointmentSummary(period)` literally (no `now` override parameter on the public API, consistent with how other modules use `new Date()` directly rather than injecting it — see this method's body). */
  getAppointmentSummary(period: ReportPeriod): Promise<AppointmentSummary>;
}

/**
 * Factory taking a repository implementation — Step 17 wires in the Prisma-backed
 * `ReportingRepository`, querying the (booking-owned) `Appointment` table directly.
 */
export function createReportingService(deps: ReportingServiceDependencies): ReportingService {
  const { repository } = deps;

  return {
    async getAppointmentSummary(period) {
      validateReportPeriod(period); // BR-REPORT-1 — exactly two accepted values

      const now = new Date();
      const range = period === "ThisWeek" ? currentWeekRange(now) : currentMonthRange(now); // BR-REPORT-1's two preset computations

      const { totalAppointments, noShowCount } = await repository.countAppointmentsInRange(range); // BR-REPORT-2/3

      return { totalAppointments, noShowCount }; // BR-REPORT-4 — no expanded return shape
    },
  };
}
