# Business Logic Model — notification

**Unit**: Pet Grooming Booking Platform
**Scope**: core business logic flows for the `notification` module. Rules referenced below (BR-NOTIF-*) are defined in `notification-business-rules.md`. Every call site into these flows was already fixed by the `booking` pass — this pass defines what happens *inside* each call.

---

## Flow 1: Send Booking Confirmation (called from `booking` Flow 1/2 — createBooking/createOverrideBooking)

```
Input: Appointment (with Owner contact info via its line items' relationships)

1. Attempt email send to Owner.email
2. Attempt SMS send to Owner.phone
   (steps 1 and 2 are independent - BR-NOTIF-3; a failure in one
   doesn't stop or affect the other)
3. If either attempt failed: Appointment.notificationFailed = true
   (BR-NOTIF-4)

Output: success/failure per channel (informational only - never
        propagated back to fail the booking itself, BR-NOTIF-3)
```

## Flow 2: Schedule Reminder (called from `booking` Flow 1/2/4 — create/override/reschedule)

```
Input: Appointment

1. Compute the fixed daily send time for the day before Appointment.slotStart
   (BR-NOTIF-1's REMINDER_SEND_TIME, on that prior calendar day)
2. If that computed time is already in the past (relative to now):
   -> BR-NOTIF-2 applies: send the reminder immediately (same content/
      channels as Flow 3 below, just triggered right now instead of by
      the daily job) - no ScheduledReminder row is created
3. Else:
   -> Create ScheduledReminder{ appointmentId, sendAt: computed time,
      status: Pending }

Output: success (either sent immediately or scheduled)
```

## Flow 3: Daily Reminder Job (batch process — mechanism is Infrastructure Design's concern; this is the business logic it runs)

```
Trigger: runs once per day at REMINDER_SEND_TIME (BR-NOTIF-1)

For each ScheduledReminder where status = Pending and sendAt <= now:
  1. Attempt email send to the Appointment's Owner.email
  2. Attempt SMS send to the Appointment's Owner.phone
     (independent, BR-NOTIF-3)
  3. If either failed: Appointment.notificationFailed = true (BR-NOTIF-4)
  4. ScheduledReminder.status = Sent
```

## Flow 4: Cancel Scheduled Reminder (called from `booking` Flow 3/4 — cancelBooking/rescheduleBooking)

```
Input: appointmentId

1. Find ScheduledReminder for this appointmentId where status = Pending
   -> none found (already Sent, was sent immediately per BR-NOTIF-2, or
      never existed): no-op, success (BR-NOTIF-5)
   -> found: status = Cancelled

Output: success (always - this is a best-effort suppression, never a
        failure case from the caller's perspective)
```

## Flow 5: Send Cancellation Confirmation (called from `booking` Flow 3 — cancelBooking, always, per BR-BOOK-9)

```
Input: Appointment (now status = Cancelled)

Same mechanics as Flow 1 (independent email/SMS attempts,
notificationFailed flag on any failure) - different message content
(a cancellation notice, not a booking confirmation), same
non-blocking guarantee (BR-NOTIF-3).
```

---

## Cross-Module Note

`notificationFailed` (BR-NOTIF-4) is a field on `Appointment`, owned by `booking` — `notification` sets it as a side effect of Flows 1, 3, and 5. This is the same pattern as `availability` setting `flaggedForReview` on an `Appointment` it doesn't own (per the `availability` pass's cross-module note) — the leaf/dependency components write specific flags onto the hub entity rather than each maintaining a parallel record.
