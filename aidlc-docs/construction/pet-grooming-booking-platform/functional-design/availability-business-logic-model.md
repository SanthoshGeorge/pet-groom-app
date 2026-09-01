# Business Logic Model — availability

**Unit**: Pet Grooming Booking Platform
**Scope**: core business logic flows for the `availability` module. Entities referenced below are defined in `availability-domain-entities.md`; rules referenced below (BR-AVAIL-*) are defined in `availability-business-rules.md`.

---

## Flow 1: Compute Available Slots (GC-1, RC-1, SO-1's calendar read)

```
Input: dateRange, serviceId

1. Clamp dateRange to [now, now + ADVANCE_BOOKING_DAYS] (BR-AVAIL-4)
2. Look up Service.durationMinutes via catalog.getService(serviceId)
   -- multi-pet totals (BR-AVAIL-1) are computed by the CALLER (booking),
      which sums each pet's service duration before calling
      getAvailableSlots/claimSlot with the total; this module only
      knows about one duration value per call
3. For each day in the clamped range:
   a. Look up WorkingHoursRule for that day-of-week
      -> isOpen = false: no slots for this day
   b. Generate candidate start times on the fixed grid from openTime
      to closeTime, step = SLOT_GRID_MINUTES (BR-AVAIL-3)
   c. For each candidate start time:
      - Discard if [start, start+duration+BUFFER_MINUTES) extends past closeTime
      - Discard if it overlaps any existing Appointment's
        [start, end+BUFFER_MINUTES) range
      - Discard if the day falls inside a TimeOff range (BR-AVAIL-8)
      - Otherwise: candidate is an open Slot
4. Return the list of open Slots across all days in range

Output: list of { start, end, serviceId } Slots
```

## Flow 2: Claim a Slot (normal booking — GC-2, RC-2, SO-2)

```
Input: slot (start + duration, already validated by caller), serviceId,
       appointmentId (the Appointment being created by `booking`)

1. Atomically (BR-AVAIL-5) check: is [slot.start, slot.start+duration+BUFFER)
   still free of overlapping Appointments, within working hours, and not
   in a TimeOff range?
   -> No (someone else claimed it, or hours/time-off changed since the
      customer loaded the page): return "slot no longer available" error
      (BR-AVAIL-6 — no auto-suggestion)
   -> Yes: the claim succeeds. In practice, "claiming" IS the creation of
      the Appointment row in `booking` — this module's job is the
      atomic availability CHECK that gates whether `booking` is allowed
      to write that row (see availability-domain-entities.md's
      SlotClaim note on there being no separate reservation table)

Output: success, or "slot no longer available" error
```

## Flow 3: Release a Slot (cancellation — GC-3, RC-3, SO-1)

```
Input: appointmentId

1. The Appointment is cancelled (by `booking`) -> its time range is no
   longer counted as "occupied" in Flow 1's overlap check (BR-AVAIL-11)
   -- no separate release action needed on availability's side beyond
   the Appointment's own status change, since availability computes
   live from Appointment data rather than a stored reservation
```

## Flow 4: Force Claim a Slot — Owner Override (SO-3)

```
Input: slot (start + duration), serviceId, appointmentId

1. Check ONLY for appointment-overlap (BR-AVAIL-10) — ignore working
   hours, buffer, and time-off constraints entirely (those are allowed
   to fail silently under override)
   -> Overlaps an existing Appointment: return success + conflictFlag=true
      (caller/UI shows the warning; owner can still confirm — SO-3's
      acceptance criteria, this module doesn't block it)
   -> No overlap: return success + conflictFlag=false
2. Either way, the resulting Appointment (created by `booking`) is
   marked with an "override" indicator whenever the slot fell outside
   normal hours/buffer/time-off (BR-AVAIL-10) — that flag is separate
   from conflictFlag and always set for any override-path booking that
   wasn't ALSO achievable through the normal claimSlot path

Output: success + conflictFlag (boolean)
```

## Flow 5: Set Working Hours (SO-5)

```
Input: schedule (7 WorkingHoursRule entries, one per day)

1. Replace all 7 WorkingHoursRule rows with the new schedule
2. Recompute: does this change remove availability that an existing
   future Appointment currently occupies? (e.g. shop now closes
   earlier than an already-booked late appointment)
   -> If yes for any appointment: flag it (BR-AVAIL-9) — surfaced to
      the shop owner via the admin calendar (booking module's concern
      to render the flag; availability just identifies which
      appointments are now out-of-hours)
   -> Appointments are never auto-cancelled
```

## Flow 6: Add Time Off (SO-5)

```
Input: dateRange (startDate, endDate)

1. Create TimeOff record (BR-AVAIL-8 — whole days, no time-of-day)
2. Find any existing future Appointments whose date falls within
   [startDate, endDate] -> flag each one (BR-AVAIL-9), same mechanism
   as Flow 5 step 2
3. From this point on, Flow 1 excludes these dates entirely from
   computed availability
```

---

## Cross-Module Notes (for the `booking` Functional Design pass)

- `booking` is responsible for summing pet service durations (BR-AVAIL-1) before calling into `availability` — `availability` itself only ever receives one already-computed total duration per call.
- The "flag an appointment" mechanism referenced in BR-AVAIL-9 (Flows 5 & 6) is defined at the data/UI level by `booking` (it owns `Appointment`) — this pass only establishes *when* availability changes should trigger a flag, not how the flag is stored or rendered. The Admin-Calendar mockup's "OVERRIDE" badge pattern is the visual precedent to extend for this second kind of flag (e.g. an "AFFECTED BY SCHEDULE CHANGE" badge) when `booking`/UI design reaches that mockup.
- `claimSlot`'s atomicity guarantee (BR-AVAIL-5) is a hard constraint that NFR Design/Infrastructure Design must satisfy for `booking`'s `createBooking` flow to be correct — flagged here so it isn't lost by the time those stages run.
