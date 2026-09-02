// reporting module data-access contract — pure interface, no implementation. Business
// logic (service.ts) depends only on this abstraction, never on Prisma directly. A
// Prisma-backed implementation is wired in during Phase F, Step 17, querying the
// (booking-owned) `Appointment` table directly — `reporting` owns no table of its own.

import type { DateRange } from "./types";

/** BR-REPORT-2/3's two counts, both scoped to the same `range`. */
export interface AppointmentCountsForRange {
  /** BR-REPORT-2 — every Appointment in `range`, any status. */
  totalAppointments: number;
  /** BR-REPORT-3 — Appointments in `range` with `status = NoShow`. */
  noShowCount: number;
}

export interface ReportingRepository {
  /** BR-REPORT-2/3 — counts Appointments whose `slotStart` falls in `range` (half-open, per DateRange's doc comment). */
  countAppointmentsInRange(range: DateRange): Promise<AppointmentCountsForRange>;
}
