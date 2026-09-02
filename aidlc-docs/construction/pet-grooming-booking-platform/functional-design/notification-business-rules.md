# Business Rules — notification

**Unit**: Pet Grooming Booking Platform
**Scope**: validation logic, constraints, and decision rules for the `notification` module, per the answered Functional Design questions. `notification` has no persistent domain entity of its own in the sense `booking`/`customer`/`catalog` do — the one piece of state it needs is described below as a conceptual marker, not a full entity file.

---

## Conceptual Entity: ScheduledReminder

Not a user-facing entity — an internal marker so `cancelScheduledReminder` has something to cancel and the daily batch job (BR-NOTIF-1) has something to send.

| Field | Type | Notes |
|---|---|---|
| `appointmentId` | id (FK -> Appointment) | one per appointment that has a pending reminder |
| `sendAt` | timestamp | the fixed daily send time on the day before `slotStart` (BR-NOTIF-1), or null if it was sent immediately (BR-NOTIF-2) |
| `status` | enum: `Pending` \| `Sent` \| `Cancelled` | |

---

**BR-NOTIF-1 — Reminders go out at a fixed daily time, not exactly 24h before (Q1=B).**
A `REMINDER_SEND_TIME` constant (default 9:00 AM, shop-local time — placeholder pending real branding/hours confirmation, same spirit as `availability`'s buffer placeholder) drives a daily batch: every appointment whose `slotStart` falls on the **next calendar day** gets its `ScheduledReminder.sendAt` set to that fixed time. This means actual notice ranges from just over 24 hours (an early-morning appointment) to just under 24 hours (a late-evening one) — accepted trade-off per Q1's answer, simpler to operate than a per-appointment 24-hours-before calculation.

**BR-NOTIF-2 — Short-notice bookings send the reminder immediately (Q2=B).**
At the moment `scheduleReminder` is called (booking creation or reschedule), if the appointment's `slotStart` is **less than 24 hours away** — meaning BR-NOTIF-1's fixed daily send time has already passed or doesn't apply (the appointment is today or the reminder day already happened) — the reminder is sent **immediately**, right after the booking confirmation, instead of being scheduled for a `ScheduledReminder` entry. This is the same channel/content as a normal reminder, just sent without the day-before delay.

**BR-NOTIF-3 — Channels are independent; failure never blocks the operation (Q3=A).**
`sendBookingConfirmation` and `sendCancellationConfirmation` each attempt email AND SMS as two independent sends. Neither channel's success or failure affects the other, and **neither affects the underlying `booking` operation** — `createBooking`/`cancelBooking`/`rescheduleBooking` succeed or fail based purely on `availability`/`booking` logic (already defined in the `booking` pass); notification is a side effect, never a gate.

**BR-NOTIF-4 — Failed sends are flagged on the appointment, not just logged (Q4=A).**
If either channel (or both) fails for a confirmation, cancellation-confirmation, or reminder send, `Appointment.notificationFailed` is set `true` — visible to the shop owner on the admin calendar (same visual treatment as the `isOverride`/`flaggedForReview` badges from the `booking` pass), so they know to call the customer directly. No automatic retry is defined in v1 (consistent with NFR-5 — resiliency baseline not applied); a manual "resend" action is a reasonable v2 addition, flagged as an open item rather than built here.

**BR-NOTIF-5 — Cancelling an appointment cancels its pending reminder (carried from `booking`'s BR-BOOK-9, defined precisely here).**
`cancelScheduledReminder(appointmentId)` sets the matching `ScheduledReminder.status = Cancelled` if one exists and is still `Pending`. If the reminder already fired (`Sent`) or was sent immediately per BR-NOTIF-2, there's nothing to cancel — no error, just a no-op.

**BR-NOTIF-6 — Rescheduling re-syncs the reminder (carried from `booking`'s BR-BOOK-10, defined precisely here).**
On reschedule: the old `ScheduledReminder` (if `Pending`) is cancelled (BR-NOTIF-5), and `scheduleReminder` runs again against the new `slotStart` — which may itself land on BR-NOTIF-1 (normal scheduling) or BR-NOTIF-2 (immediate send, if the new slot is now short-notice).

**BR-NOTIF-7 — Booking confirmation is always immediate (FR-10, unchanged from Application Design).**
`sendBookingConfirmation` and `sendCancellationConfirmation` are never scheduled/batched — they fire synchronously (or as an immediate async side effect) as part of `createBooking`/`createOverrideBooking`/`cancelBooking` completing. Only the reminder has the day-before timing question this pass resolves.
