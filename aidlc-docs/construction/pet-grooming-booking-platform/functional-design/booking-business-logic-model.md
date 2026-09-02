# Business Logic Model — booking

**Unit**: Pet Grooming Booking Platform
**Scope**: core business logic flows for the `booking` module — the hub that coordinates `availability`, `customer`, `notification`, and `auth`. Entities referenced below are defined in `booking-domain-entities.md`; rules referenced below (BR-BOOK-*) are defined in `booking-business-rules.md`.

---

## Flow 1: Create a Booking (GC-2, RC-2, SO-2 — same flow, different `createdBy`)

```
Input: ownerInfo (or ownerId if already known/logged in), petServicePairs[]
       (each: petId-or-new-pet-details + serviceId), slot start time,
       createdBy (guest | account | owner)

1. customer.createOrFindOwner(ownerInfo) -> Owner (Flow 1 of the
   customer/auth pass — same identity-resolution logic, BR-CUST-1)
2. For each pair in petServicePairs: if it's a new pet, customer.addPet(...)
   -> Pet; if referencing an existing pet (RC-2's saved pets), use as-is
3. For each pair: catalog.getService(serviceId) -> price/duration,
   used to build one AppointmentLineItem with a price/duration SNAPSHOT
   (BR-CAT-4) — this is where the snapshot actually gets written
4. totalDuration = sum of all line items' durationSnapshotMinutes (BR-BOOK-1)
5. availability.claimSlot({start: slot, duration: totalDuration}, appointmentId)
   -> fails ("slot no longer available"): abort, return error to caller,
      no Appointment/line items are persisted (BR-AVAIL-6 — no
      auto-suggestion, caller re-fetches availability)
   -> succeeds: continue
6. Create Appointment (status=Booked, createdBy, bookingReference per
   BR-BOOK-8, isOverride=false, hasConflict=false) + its line items
7. notification.sendBookingConfirmation(appointment) — to the OWNER's
   contact info regardless of createdBy (FR-10, BR-BOOK-9's sibling rule)
8. notification.scheduleReminder(appointment)

Output: Appointment (with bookingReference) or a "slot no longer
        available" error
```

## Flow 2: Create an Override Booking (SO-3)

```
Input: same as Flow 1, owner-only (requires auth.validateSession, role=owner)

1-4. Same as Flow 1 steps 1-4
5. availability.forceClaimSlot({start, duration}, appointmentId)
   -> returns success + conflictFlag (BR-AVAIL-10 — true only on real
      appointment overlap; false for merely-outside-hours/buffer/time-off)
6. Create Appointment: isOverride = true whenever the slot fell outside
   normal hours/buffer/time-off (i.e., whenever this path was NEEDED
   instead of a normal claimSlot succeeding); hasConflict = the
   conflictFlag from step 5
7-8. Same notification calls as Flow 1 (BR-BOOK-11) — confirmation and
     reminder go out identically to a normal booking

Output: Appointment (isOverride=true, hasConflict reflects any real
        double-booking) — the owner sees the warning (from conflictFlag)
        in the UI before confirming, per SO-3's acceptance criteria, but
        this module doesn't block on it — confirming is the owner's call
```

## Flow 3: Cancel a Booking (GC-3, RC-3, SO-1)

```
Input: appointmentId, actor (guest | account | owner)

1. Look up Appointment
   -> status != Booked: return "this appointment can no longer be
      modified" error (BR-BOOK-6)
2. availability.releaseSlot(appointmentId) — frees the time range
3. Appointment.status = Cancelled, cancelledAt = now, cancelledBy = actor
4. notification.cancelScheduledReminder(appointmentId) — suppresses the
   day-before SMS if cancellation happens before it would have fired
   (FR-10's cancellation carve-out)
5. notification.sendCancellationConfirmation(appointment) — ALWAYS to
   the customer, regardless of actor (BR-BOOK-9)

Output: success, or the terminal-state error from step 1
```

## Flow 4: Reschedule a Booking (GC-3, RC-3)

```
Input: appointmentId, newSlot

1. Look up Appointment
   -> status != Booked: return "this appointment can no longer be
      modified" error (BR-BOOK-6)
2. totalDuration = sum of existing line items' durations (unchanged by
   a reschedule — only the slot moves, not the services/pets)
3. availability.claimSlot({start: newSlot, duration: totalDuration},
   appointmentId) — claim the NEW slot first
   -> fails: abort entirely, original Appointment untouched (BR-BOOK-3
      — the release only happens once the new claim is confirmed, so a
      failed reschedule never leaves the customer with no slot at all)
   -> succeeds: continue
4. availability.releaseSlot(appointmentId) — free the OLD slot
   (referencing the appointment's previous slotStart/slotEnd)
5. Update Appointment.slotStart/slotEnd to newSlot's range (same id,
   same bookingReference — BR-BOOK-3)
6. notification.cancelScheduledReminder(appointmentId) then
   notification.scheduleReminder(appointment) — re-syncs the day-before
   reminder to the new date (BR-BOOK-10)

Output: updated Appointment, or the terminal-state/claim-failure error
```

## Flow 5: Guest Lookup (GC-3)

```
Input: bookingReference, contactInfo (phone or email)

1. Find Appointment by bookingReference
   -> not found: generic "not found" error (never reveal whether the
      reference itself is valid, to avoid leaking which references exist)
2. Compare contactInfo against the Appointment's Owner: email
   case-insensitive OR phone digits-only match (BR-BOOK-5)
   -> no match: same generic "not found" error (never reveal that the
      reference WAS valid but the contact info was wrong — that would
      let someone brute-force contact info against a known reference)
   -> match: return the Appointment

Output: Appointment, or a generic not-found error (same error either
        way, by design, per GC-3's "cannot view or modify someone
        else's booking" edge case)
```

## Flow 6: List Appointments (SO-1 calendar, RC-3 "my bookings")

```
listAllBookings(dateRange):     admin-only (auth.validateSession, role=owner)
  -> all Appointments in range, any status, any owner — powers the
     Admin-Calendar view (including isOverride/hasConflict/
     flaggedForReview badges)

listMyBookings(accountId):      customer-only (auth.validateSession)
  -> Appointments for the Owner linked to this account, upcoming AND
     past (RC-3 needs to show past ones as read-only/completed, per
     RC-3's edge case) — the UI distinguishes by `status`, this module
     just returns everything and lets status drive presentation
```

## Flow 7: Mark No-Show (SO-6's data source; admin-only, new per Q2=A)

```
Input: appointmentId

1. Look up Appointment
   -> status != Completed: reject (BR-BOOK-2b — can't mark a still-
      upcoming Booked appointment, or one already Cancelled, as a no-show)
2. Appointment.status = NoShow

Output: success, or a rejection if not eligible
```

---

## Cross-Module Notes (for the `notification`/`reporting` Functional Design pass)

- Every notification call site is now fixed by this pass: `sendBookingConfirmation`/`scheduleReminder` (Flows 1 & 2), `cancelScheduledReminder`/`sendCancellationConfirmation` (Flow 3), and the reschedule re-sync pair (Flow 4, BR-BOOK-10). The `notification` pass defines HOW each of these actually sends email/SMS and schedules the day-before job — not WHEN they're called, which is now settled.
- `reporting`'s `getAppointmentSummary(period)` will read `Appointment.status` values directly — `NoShow` count (SO-6) is exactly `count(status = NoShow)` in the period, now that Flow 7 defines how that status gets set.
