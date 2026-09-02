// reporting module domain types — reporting-business-rules.md: "`reporting` owns no
// entity of its own — it reads `Appointment` data from `booking`." No entity file exists
// for this module; the types below are the request/response shapes BR-REPORT-1..4 define.

/** BR-REPORT-1 — the exactly-two preset periods `getAppointmentSummary` accepts. No custom date range in v1. */
export type ReportPeriod = "ThisWeek" | "ThisMonth";

/** BR-REPORT-4 — `getAppointmentSummary`'s output shape, matching component-methods.md's "counts (total appointments, no-shows)". */
export interface AppointmentSummary {
  /** BR-REPORT-2 — every Appointment whose `slotStart` falls in the period, regardless of status (booking *volume*, not just completed visits). */
  totalAppointments: number;
  /** BR-REPORT-3 — count(Appointment.status = NoShow AND slotStart in period). */
  noShowCount: number;
}

/** Half-open `[start, end)` calendar range — `slotStart >= start && slotStart < end`. */
export interface DateRange {
  start: Date;
  end: Date;
}
