# Business Rules — availability

**Unit**: Pet Grooming Booking Platform
**Scope**: validation logic, constraints, and decision rules for the `availability` module, per the answered Functional Design questions.

---

**BR-AVAIL-1 — Multi-pet duration is sequential (Q1=A).**
A booking's total duration = the **sum** of each included pet's service duration. Two pets getting a Full Groom (90 min) and a Nail Trim (15 min) in one visit claim a single 105-minute slot, back-to-back, since there is one groomer (FR-2). This applies uniformly regardless of which services are combined.

**BR-AVAIL-2 — Buffer is a fixed, system-wide constant (Q2=A).**
Every appointment is followed by `BUFFER_MINUTES` (15 min default) of unavailable time before the next slot can start. This is not per-service and not owner-editable via any UI in v1 — changing it requires a configuration change (Code Generation concern, not a runtime admin setting). Flagged as a placeholder value pending real-world confirmation from the groomer.

**BR-AVAIL-3 — Slot start times fall on a fixed grid (Q3=A).**
Valid slot start times are `WorkingHoursRule.openTime`, `openTime + SLOT_GRID_MINUTES`, `openTime + 2×SLOT_GRID_MINUTES`, etc., up to whatever last grid point still allows the full appointment duration (BR-AVAIL-1) to finish by `closeTime`. A slot is only offered if the entire span `[start, start + duration + BUFFER_MINUTES)` is free of overlapping appointments and outside any `TimeOff` block.

**BR-AVAIL-4 — Availability is computed 14 days ahead (Q4=A).**
`getAvailableSlots(dateRange, serviceId)` is bounded to `[now, now + ADVANCE_BOOKING_DAYS]` regardless of what `dateRange` requests beyond that — a caller cannot query further into the future than the configured window in v1.

**BR-AVAIL-5 — Slot claims must be atomic (GC-1 edge case).**
`claimSlot`/`forceClaimSlot` must guarantee that two concurrent callers cannot both succeed in claiming an overlapping time range. This is a hard requirement carried directly from GC-1's edge case ("the system does not falsely show it as taken preemptively" + GC-2's "I am not double-booked into the same slot as someone else"). The specific mechanism (database constraint, transaction isolation level, optimistic lock) is an NFR Design / Infrastructure Design decision — this rule only fixes the *guarantee*, not the *implementation*.

**BR-AVAIL-6 — No auto-suggestion on claim failure (Q5=A).**
When `claimSlot` fails because the slot was taken between the customer viewing it and submitting, the caller (`booking`) receives a "slot no longer available" error and is expected to re-fetch availability and let the customer pick again. `availability` does not compute or return an alternative slot as part of the failure response.

**BR-AVAIL-7 — Working hours: one range per day, no split schedules (Q6=A).**
Every day of the week has exactly one `WorkingHoursRule` — either fully closed (`isOpen = false`) or open continuously from `openTime` to `closeTime`. There is no way to represent a lunch closure or any other mid-day gap in v1 (setting the hours to, say, 9am-5pm means the shop is bookable straight through that window, buffer/existing-appointments aside).

**BR-AVAIL-8 — Time off blocks whole calendar days only (Q7=A).**
A `TimeOff` entry removes availability for every slot on each date in its `[startDate, endDate]` range. There's no partial-day time off — the shop owner marking "Tuesday" off blocks all of Tuesday, even if they only intended to skip the afternoon (known v1 limitation, not a blocking gap per SO-5's acceptance criteria).

**BR-AVAIL-9 — Working-hours/time-off changes never auto-cancel appointments (SO-5).**
Calling `setWorkingHours` or `addTimeOff` only changes what's computed as available going forward; it never touches existing `Appointment` rows. If the change creates a conflict with an already-booked appointment (e.g. new time off overlaps a booked slot), that appointment is **flagged** (a status/indicator surfaced to the shop owner in the admin calendar — the flagging mechanism itself is a `booking`-module concern, referenced here as a dependency) for the owner to manually address — cancel, reschedule, or override and keep it. The system never cancels on the owner's behalf.

**BR-AVAIL-10 — Override conflict = appointment overlap only (Q8=A).**
`forceClaimSlot` (SO-3) bypasses BR-AVAIL-3 (grid), BR-AVAIL-7 (hours), and BR-AVAIL-8 (time off) silently — those produce the "OVERRIDE" flag on the resulting appointment (per the mockup's dashed/flagged slot treatment) but **no conflict warning**. A conflict warning is raised **only** when the requested `[start, start+duration)` range would overlap another already-booked `Appointment`'s time range — true double-booking. Even then, per SO-3's acceptance criteria, the owner can confirm anyway (warned, not blocked).

**BR-AVAIL-11 — `releaseSlot` is unconditional.**
Cancelling an appointment (`releaseSlot(appointmentId)`) always frees its time range for future claims, regardless of how it was originally booked (normal or override) — there's no scenario in the stories where a cancelled appointment's time should stay blocked.
