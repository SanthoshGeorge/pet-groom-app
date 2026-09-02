// Effective-status computation — BR-BOOK-2 (Q2=A).
//
// "A background/on-read check treats any Booked appointment whose slotEnd has passed as
// Completed. Whether this is a stored write... or a computed read-time value is an
// Infrastructure Design decision, not fixed here — the business rule only requires that a
// past appointment reads as Completed by default." This module implements it as a pure
// read-time computation, applied uniformly wherever an Appointment is returned to a
// caller AND wherever a status-lifecycle precondition is checked (BR-BOOK-6, BR-BOOK-2b) —
// so `cancelBooking`/`rescheduleBooking`/`markNoShow` all see the same "already occurred"
// truth a caller reading the appointment would see, never trusting the raw stored
// `Booked` value past its `slotEnd`. No physical write is made here (Step 17/a future
// scheduled job may choose to also persist the flip; this module works correctly either
// way since it never depends on the raw stored value once past `slotEnd`).

import type { Appointment, AppointmentStatus, AppointmentWithLineItems } from "./types";

export function computeEffectiveStatus(status: AppointmentStatus, slotEnd: Date, now: Date = new Date()): AppointmentStatus {
  if (status === "Booked" && slotEnd.getTime() <= now.getTime()) {
    return "Completed";
  }
  return status;
}

export function withEffectiveStatus<T extends Appointment>(appointment: T, now: Date = new Date()): T {
  const effective = computeEffectiveStatus(appointment.status, appointment.slotEnd, now);
  if (effective === appointment.status) {
    return appointment;
  }
  return { ...appointment, status: effective };
}

export function withEffectiveStatusList(appointments: AppointmentWithLineItems[], now: Date = new Date()): AppointmentWithLineItems[] {
  return appointments.map((a) => withEffectiveStatus(a, now));
}
