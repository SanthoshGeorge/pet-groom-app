# Functional Design Plan — availability module

**Unit**: Pet Grooming Booking Platform (single unit, per `unit-of-work.md`)
**Scope of this pass**: the second group in the internal build order — `availability` (depends on `catalog` for service duration, per `component-dependency.md`). `auth`/`customer`/`catalog` are approved and complete. `booking` and `notification`/`reporting` come next.

## Plan

- [ ] Define domain entities: working hours, time-off blocks, slots (computed, not stored), and the concurrency-safe claim mechanism at the business-rule level
- [ ] Define business rules for slot computation (shop hours minus bookings minus buffer minus time off)
- [ ] Define business rules for multi-pet slot sizing (FR-4's "back-to-back or in parallel" is currently ambiguous — resolving it here)
- [ ] Define business rules for the owner override path (SO-3) and what counts as a "conflict"
- [ ] Define business rules for working-hours/time-off management (SO-5), including how existing appointments are flagged
- [ ] Resolve open questions below with the user
- [ ] Generate `business-logic-model.md`, `business-rules.md`, `domain-entities.md` for `availability` (no new frontend components in this pass — the booking-flow screens that display availability were already drafted in the mockup canvas; admin working-hours screens are simple settings forms, deferred to the `booking` pass alongside the rest of the admin UI unless you'd rather do them now)

## Questions

Please answer each question by filling in the letter choice after the `\[Answer\]:` tag. If none of the options match, choose the last option ("Other") and describe your answer.

### Question 1 — Multi-pet appointment duration (FR-4)
FR-4 says a visit can include multiple pets "groomed back-to-back or in parallel" — that's two different answers with very different slot-sizing math, for a shop with **one groomer** (FR-2). If Jamie books Biscuit (Full Groom, 90 min) and a second pet (Nail Trim, 15 min) in the same visit, how long is the slot that gets claimed?

A) **Sequential (back-to-back)** — one groomer can only work on one dog at a time, so the slot claimed is the **sum** of each pet's service duration (90 + 15 = 105 min here). This matches the "one groomer" reality in FR-2.

B) **Parallel (same slot)** — the slot claimed is just the **longest** individual service's duration; pets are assumed groomed independently/simultaneously somehow (e.g. one bathed while the other air-dries) — this only makes sense with helper capacity FR-2 says doesn't exist yet

C) **Ask the shop owner to weigh in later, default to sequential for now** — build to Option A but flag it as something to confirm once the real groomer explains how he actually handles multi-pet visits

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 2 — Buffer time between appointments (FR-5)
FR-5 requires buffer time between appointments for cleanup. How is that buffer determined?

A) **Fixed system-wide value** (e.g. 15 minutes after every appointment, regardless of service) — simplest, configurable later as a setting

B) **Per-service buffer** — each `Service` gets its own buffer duration (e.g. Full Groom needs more cleanup time than a Nail Trim) — more accurate, adds a field to `Service`

C) **Owner-configurable single setting** — one buffer value the shop owner can change from admin settings (same as Option A initially, but explicitly editable rather than hardcoded)

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 3 — Slot start-time granularity
When `getAvailableSlots` computes open slots, what determines valid *start* times — e.g. can a slot start at 10:07, or only at fixed points like 10:00/10:15/10:30?

A) **Fixed grid** — slots can only start on a regular interval (e.g. every 15 minutes), regardless of the previous appointment's exact end time; some open time may go unused between a slot's end and the next grid line

B) **Back-to-back packing** — the next available start time is exactly when the previous appointment (plus buffer) ends, no fixed grid — maximizes usable time but produces irregular-looking start times

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 4 — Advance booking window
GC-1 says customers see slots "for the next several days." How far ahead should availability actually be computed/shown?

A) **14 days**

B) **30 days**

C) **7 days**

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 5 — Slot-claim race behavior (GC-2 edge case)
GC-2's edge case already establishes that a losing customer sees "slot no longer available" and refreshed availability. Beyond that baseline: should the system also **suggest the nearest alternative open slot** automatically when a claim fails, or is showing refreshed availability (and letting the customer pick again) enough for v1?

A) Just refreshed availability — no auto-suggestion (matches the acceptance criteria as written, simplest)

B) Auto-suggest the nearest available slot as a convenience on top of the refreshed list

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 6 — Working hours shape (SO-5)
Are the shop's weekly working hours a single start/end time per day (e.g. Tue 9am–5pm), or can a day have a split schedule (e.g. 9am–12pm, then 2pm–6pm with a lunch closure)?

A) **Single continuous range per day of week** — one open/close time per day, some days fully closed (e.g. Sunday)

B) **Multiple ranges per day allowed** — supports split schedules like a lunch break

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 7 — Time-off granularity (SO-5)
`addTimeOff(dateRange)` — can time off be a partial day (e.g. "off this Tuesday afternoon"), or only whole calendar days?

A) **Whole days only** — a time-off entry blocks one or more full calendar days

B) **Partial days supported** — a time-off entry can be a specific time range within a day (e.g. 1pm–5pm on a given date), in addition to whole days

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 8 — What counts as a "conflict" for override warnings (SO-3)
SO-3 says an override that "would conflict with an already-booked appointment" shows a warning but can still be confirmed. To be precise: does "conflict" mean **only** double-booking against another real appointment (two appointments overlapping in time), or does it also cover booking outside working hours / inside a buffer window (which SO-3's first acceptance criterion already says is silently allowed, no warning — just flagged as override)?

A) **Conflict = only appointment-overlap** — warn only when the override would overlap an existing appointment's time; outside-hours/inside-buffer overrides get the "OVERRIDE" flag (per the mockup) but no conflict warning, since that's the whole point of an override

B) **Conflict = anything abnormal** — warn for outside-hours, inside-buffer, AND overlapping-appointment cases alike, letting the owner confirm through any of them

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A