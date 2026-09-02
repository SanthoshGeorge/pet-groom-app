# Functional Design Plan — notification / reporting modules

**Unit**: Pet Grooming Booking Platform (single unit, per `unit-of-work.md`)
**Scope of this pass**: the fourth and final group in the internal build order — `notification` and `reporting` (both "leaf" components per `component-dependency.md`: they consume data from `booking` but nothing depends on them). `auth`/`customer`/`catalog`, `availability`, and `booking` are all approved and complete — every call site into `notification` (`sendBookingConfirmation`, `scheduleReminder`, `cancelScheduledReminder`, `sendCancellationConfirmation`) and every status `reporting` will read (`Booked`/`Completed`/`Cancelled`/`NoShow`) is already settled by the `booking` pass.

## Plan

- [ ] Define exactly when the day-before reminder fires (FR-10 says "1 day before" — needs a precise rule)
- [ ] Define what happens on a reschedule that leaves less than a day's notice
- [ ] Define channel-failure behavior (email fails but SMS succeeds, or vice versa; does a notification failure ever block the booking itself)
- [ ] Define what's surfaced to the shop owner when a notification fails to send
- [ ] Define reporting period selection and what counts as "an appointment" in a period (SO-6)
- [ ] Resolve open questions below with the user
- [ ] Generate `notification-business-logic-model.md`, `notification-business-rules.md`, `reporting-business-rules.md` (no new domain entities pass needed — `notification` has no persistent entities of its own beyond a scheduled-reminder marker, and `reporting` reads `booking`'s `Appointment` data rather than owning any entity; no new frontend components — the reports view is already sketched in spirit by the Admin-Calendar mockup's stat-strip pattern, and this pass will note how SO-6's own reports screen extends that pattern rather than re-drafting it)

## Questions

Please answer each question by filling in the letter choice after the `\[Answer\]:` tag. If none of the options match, choose the last option ("Other") and describe your answer.

### Question 1 — Exact reminder timing (FR-10)
FR-10 says a reminder SMS goes out "1 day before" the appointment. Precisely when?

A) **Exactly 24 hours before `slotStart`** — e.g. a 2:00 PM appointment gets its reminder at 2:00 PM the day before, whatever that clock time is

B) **A fixed daily send time** (e.g. 9:00 AM) for every appointment happening the next calendar day, regardless of the appointment's own time — simpler to batch/operate, but a 7:00 AM appointment's reminder would arrive over a day ahead, and a late-evening one's would arrive with less than 24 hours' notice

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
### Question 2 — Short-notice booking/reschedule (edge case not covered by any story)
If an appointment is booked (or rescheduled into) a slot **less than 24 hours away** — e.g. a same-day walk-in via SO-2/SO-3, or GC-3/RC-3 rescheduling to tomorrow morning — there's no way to send a reminder "1 day before" since that moment has already passed. What happens?

A) **Skip the reminder entirely** — if the scheduled reminder time would already be in the past at booking/reschedule time, don't schedule one at all; the booking confirmation (sent immediately either way, per FR-10) is the only notification

B) **Send the reminder immediately instead** — if there's no room for a proper day-before reminder, send it right away as a substitute, back-to-back with the confirmation

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
### Question 3 — Channel-failure behavior
`sendBookingConfirmation`/`sendCancellationConfirmation` send both email AND SMS (FR-10). If one channel fails (e.g. an invalid phone number typo) but the other succeeds, what should happen — and does a total notification failure ever block the underlying booking/cancellation itself?

A) **Channels are independent; notification failure never blocks the operation** — email and SMS are each attempted regardless of the other's outcome; the booking/cancellation itself always succeeds once `availability`/`booking` logic completes, even if BOTH notification channels fail (matches FR-9/NFR-5's lean, non-blocking spirit — a booking is real even if the confirmation text bounces)

B) **Notification failure blocks the booking** — if neither channel can be confirmed sent, the whole `createBooking` call fails and no appointment is created (stricter, but ties the customer's slot to a third-party email/SMS provider's uptime, which FR-9/NFR-5 didn't ask for)

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 4 — Visibility of failed notifications to the shop owner
If a confirmation or reminder fails to send (both channels, or one), should the shop owner see that anywhere, so they know to call the customer directly?

A) **Yes — flag it on the appointment** — a simple boolean/indicator (e.g. `notificationFailed`) visible on the admin calendar, similar visual treatment to the existing `isOverride`/`flaggedForReview` badges from the `booking` pass

B) **No — log only, not owner-visible in v1** — failures are recorded in system logs (for debugging) but nothing surfaces in the UI; simplest, but the owner has no way to know a customer might show up confused or not show up at all

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 5 — Reporting period selection (SO-6)
SO-6 says the owner can "select a different time period." The mockup's stat strip shows "This Week" style tiles. What period options should `getAppointmentSummary(period)` actually support?

A) **Preset periods only** — "This Week" and "This Month" (matches the mockup exactly), computed relative to today; no custom range picker

B) **Custom date range** — the owner can pick any start/end date, in addition to (or instead of) the presets

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 6 — What counts toward the "appointments" total in a report period (SO-6)
The mockup shows "24 appointments" for "this week." Does that count include cancelled appointments, or only ones that actually happened (or are still upcoming)?

A) **Everything except Cancelled** — `Booked`, `Completed`, and `NoShow` appointments whose `slotStart` falls in the period all count toward the total; `Cancelled` ones are excluded (a cancelled appointment isn't really "an appointment that week" from a business-volume perspective)

B) **Everything, including Cancelled** — the total reflects every appointment ever created for that period regardless of what happened to it afterward

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B