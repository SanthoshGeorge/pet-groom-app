# Business Rules — reporting

**Unit**: Pet Grooming Booking Platform
**Scope**: validation logic and decision rules for the `reporting` module (SO-6). `reporting` owns no entity of its own — it reads `Appointment` data from `booking`.

---

**BR-REPORT-1 — Preset periods only (Q5=A).**
`getAppointmentSummary(period)` accepts exactly two period values: `ThisWeek` and `ThisMonth`, computed relative to today (server/shop-local time). No custom date range in v1. `ThisWeek` = the current calendar week (Monday–Sunday); `ThisMonth` = the current calendar month.

**BR-REPORT-2 — Appointment total includes every status, including Cancelled (Q6=B).**
The "total appointments" count for a period = every `Appointment` whose `slotStart` falls within the period, **regardless of status** (`Booked`, `Completed`, `Cancelled`, `NoShow` all count). This matches the mockup's framing of the number as overall booking *volume* for the period, not just completed visits.

**BR-REPORT-3 — No-show count.**
The no-show count for a period = `count(Appointment.status = NoShow AND slotStart in period)`. Straightforward given `booking`'s BR-BOOK-2's status lifecycle — no additional decision needed here.

**BR-REPORT-4 — Output shape.**
`getAppointmentSummary(period)` returns `{ totalAppointments, noShowCount }`, matching `component-methods.md`'s existing method signature ("counts (total appointments, no-shows)") — this pass doesn't expand the return shape (e.g. no revenue breakdown, since FR-9 keeps payments out of scope and no story asks for one).
