// reporting module (ReportingService) — Code Generation Phase B, Step 9.
// Implements BR-REPORT-1..4 (reporting-business-rules.md). Stories: SO-6.

export { InvalidReportPeriodError } from "./errors";
export type { AppointmentCountsForRange, ReportingRepository } from "./repository";
export { createReportingService } from "./service";
export type { ReportingService, ReportingServiceDependencies } from "./service";
export type { AppointmentSummary, DateRange, ReportPeriod } from "./types";
export { validateReportPeriod } from "./validation";
