// In-memory fake of ReportingRepository (src/modules/reporting/repository.ts), for unit
// testing ReportingService without a real database. `reporting` owns no entity of its
// own (reporting-business-rules.md's header note) — it only ever counts Appointments in
// a range — so this fake models just enough of an Appointment (`slotStart` + `status`)
// to compute BR-REPORT-2/3's two counts, rather than depending on booking's fuller
// `AppointmentWithLineItems` shape.

import type { AppointmentCountsForRange, ReportingRepository } from "@/modules/reporting/repository";
import type { DateRange } from "@/modules/reporting/types";

export interface FakeReportingAppointment {
  slotStart: Date;
  status: "Booked" | "Completed" | "Cancelled" | "NoShow";
}

export interface FakeReportingRepository extends ReportingRepository {
  _appointments: FakeReportingAppointment[];
}

export function createFakeReportingRepository(): FakeReportingRepository {
  const appointments: FakeReportingAppointment[] = [];

  return {
    _appointments: appointments,

    async countAppointmentsInRange(range: DateRange): Promise<AppointmentCountsForRange> {
      const inRange = appointments.filter(
        (a) => a.slotStart.getTime() >= range.start.getTime() && a.slotStart.getTime() < range.end.getTime(),
      );
      return {
        totalAppointments: inRange.length, // BR-REPORT-2 — every status counts
        noShowCount: inRange.filter((a) => a.status === "NoShow").length, // BR-REPORT-3
      };
    },
  };
}
