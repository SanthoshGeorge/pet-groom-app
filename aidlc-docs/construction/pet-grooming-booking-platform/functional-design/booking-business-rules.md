# Business Rules — booking

**Unit**: Pet Grooming Booking Platform
**Scope**: validation logic, constraints, and decision rules for the `booking` module, per the answered Functional Design questions.

---

**BR-BOOK-1 — Per-pet service selection (Q1=A).**
Each pet in a visit has its own `AppointmentLineItem` with its own `serviceId`. Total slot duration = sum of each line item's `durationSnapshotMinutes` (already established by `availability`'s BR-AVAIL-1). This resolves the conflict between the old single-`serviceId` `createBooking` signature and FR-6/FR-4's wording — the signature updates in Code Generation.

**BR-BOOK-2 — Status auto-completes; no-show is a manual override (Q2=A).**
A background/on-read check treats any `Booked` appointment whose `slotEnd` has passed as `Completed`. Whether this is a stored write (a scheduled job flips the status) or a computed read-time value is an Infrastructure Design decision, not fixed here — the business rule only requires that a past appointment reads as `Completed` by default. The shop owner can call `markNoShow(appointmentId)` on any `Completed` appointment to reclassify it as `NoShow` (BR-BOOK-2b: only from `Completed`, never from `Booked`, `Cancelled`, or already `NoShow`).

**BR-BOOK-3 — Reschedule preserves identity (Q3=A).**
`rescheduleBooking(appointmentId, newSlot)` keeps the same `Appointment.id` and `bookingReference`. Internally: release the old slot (`availability.releaseSlot`) and claim the new one (`availability.claimSlot`) — both must succeed together; if the new slot can't be claimed (someone else took it first), the reschedule fails and the original slot/status are unchanged (the release only commits once the new claim succeeds). Only valid while `status = Booked` (BR-BOOK-6).

**BR-BOOK-4 — Cancel/reschedule apply to the whole appointment (Q4=A).**
There is no partial cancel/reschedule of one pet within a multi-pet `Appointment` in v1 — the entire visit (all line items) moves or cancels together. A customer who wants to drop one pet from a multi-pet visit needs the shop owner's help (manual admin action, no dedicated method for it — flagged as an open item, not blocking since no story requires self-service partial cancellation).

**BR-BOOK-5 — Guest lookup matching (Q5=A).**
`lookupBooking(reference, contactInfo)` requires an exact `bookingReference` match AND a match on **either** the phone or the email associated with the `Appointment`'s `Owner` — email compared case-insensitively, phone compared digit-by-digit (formatting characters like `-`, `(`, `)`, spaces stripped before comparing). Reference-only or contact-only lookups are always rejected — both must be supplied and both must correspond to the same `Appointment`.

**BR-BOOK-6 — Terminal-state protection (GC-3/RC-3 edge case).**
`cancelBooking` and `rescheduleBooking` are only valid when `status = Booked`. Calling either on a `Completed`, `Cancelled`, or `NoShow` appointment returns a clear "this appointment can no longer be modified" error — never a silent no-op or a generic failure (per GC-3's explicit acceptance criterion).

**BR-BOOK-7 — Visit notes are separate from permanent pet notes (Q6=A).**
The appointment detail view (SO-1) surfaces both: `Pet.temperamentNotes`/`allergyMedicalNotes` (editable via `customer.updatePet`, carries forward to future visits) and `Appointment.visitNotes` (editable directly on the appointment, this-visit-only, e.g. "seemed anxious today, ran behind schedule"). Editing one never touches the other.

**BR-BOOK-8 — Booking reference format (Q7=A).**
`bookingReference` = a shop-initials prefix (placeholder `HTG` pending real branding, per NFR-2) + a short random alphanumeric suffix (matches the mockup's `HTG-4821` pattern). Uniqueness is enforced; a collision (rare, given the random suffix's space) triggers regeneration, not a user-facing error.

**BR-BOOK-9 — Cancellation notifications always go to the customer (Q8=A).**
Regardless of whether the customer or the shop owner initiates a cancellation (SO-1's "cancel any appointment" included), `notification.sendCancellationConfirmation` and `notification.cancelScheduledReminder` are called for the customer on file — extending FR-10's existing "notify the customer regardless of who created it" pattern consistently to cancellations. `cancelledBy` records who did it, for the owner's own reference, but doesn't change who gets notified.

**BR-BOOK-10 — Reschedule keeps the reminder in sync (not one of the 8 questions — a necessary consequence, not an assumption to flag).**
When `rescheduleBooking` succeeds, `notification.cancelScheduledReminder` (for the old slot) and `notification.scheduleReminder` (for the new slot) are both called, so the day-before SMS fires relative to the *new* time, not the original one. Whether a separate "your appointment was rescheduled" confirmation is sent (beyond the reminder re-sync) is not required by any story — flagged as an open item, not built in this pass.

**BR-BOOK-11 — Override booking still goes through the same notification path (SO-3).**
`createOverrideBooking` triggers `sendBookingConfirmation` and `scheduleReminder` exactly like a normal `createBooking` — an override changes *how* the slot was claimed (bypassing `availability`'s normal constraints), not the customer-facing notification behavior.
