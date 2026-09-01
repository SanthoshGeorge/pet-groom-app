# Domain Entities — availability

**Unit**: Pet Grooming Booking Platform
**Scope**: entities owned by the `availability` module. `Appointment` (owned by `booking`) is referenced but not defined here.

## Entity Summary

| Entity | Purpose |
|---|---|
| `WorkingHoursRule` | The shop's regular weekly schedule (SO-5) |
| `TimeOff` | A whole-day (or multi-day) block where no new bookings are allowed (SO-5) |
| `Slot` | A computed (not stored) open time window — the output of availability computation, not a database row |
| `SlotClaim` | The record that makes a slot "taken" — in practice this is implicit in `Appointment` (owned by `booking`), not a separate table; documented here as a concept because `availability`'s business rules depend on it existing |

## WorkingHoursRule

One row per day of the week (Q6=A — single continuous range per day; no split/lunch-break schedules in v1).

| Field | Type | Notes |
|---|---|---|
| `id` | id | primary key |
| `dayOfWeek` | enum: `Mon`..`Sun` | one row per day |
| `isOpen` | boolean | `false` = closed all day (e.g. Sunday) |
| `openTime` | time, nullable | null when `isOpen = false` |
| `closeTime` | time, nullable | null when `isOpen = false` |

**Constraint**: exactly one `WorkingHoursRule` per `dayOfWeek` (7 rows total, always present — a day with no explicit configuration defaults to closed).

## TimeOff

| Field | Type | Notes |
|---|---|---|
| `id` | id | primary key |
| `startDate` | date | inclusive |
| `endDate` | date | inclusive; equals `startDate` for a single day off |
| `reason` | string, optional | shop-owner-facing note only |
| `createdAt` | timestamp | |

**Note (Q7=A — whole days only)**: no time-of-day fields. A `TimeOff` entry always blocks the full calendar day(s) in its range. Partial-day time off (e.g. "off Tuesday afternoon") is not supported in v1 — flagged as a known limitation, not a blocking gap, since SO-5's acceptance criteria don't require it.

## Slot (computed)

Not a stored entity — the output shape of `getAvailableSlots(dateRange, serviceId)`:

| Field | Type | Notes |
|---|---|---|
| `start` | timestamp | falls on the fixed grid (BR-AVAIL-3) |
| `end` | timestamp | `start` + total appointment duration (BR-AVAIL-1) |
| `serviceId` | id | the service this slot was computed for (duration varies by service) |

## SlotClaim (conceptual)

There is no separate `SlotClaim` table. "Claiming" a slot means `booking` successfully creates an `Appointment` row covering that time range; `isSlotAvailable`/`claimSlot` work by checking for overlapping `Appointment` rows (plus working hours / buffer / time off), not by writing to a dedicated reservation table. This keeps a single source of truth (appointments) rather than two structures that could drift out of sync. The **atomicity** guarantee needed to prevent the GC-1 double-booking race (two customers claiming the same slot at once) is a concurrency mechanism (e.g. a DB-level unique constraint or transaction) — the *business* rule (BR-AVAIL-5) requires atomicity; the *technical* mechanism is decided in NFR Design, per this module's prerequisites.

## Configuration Constants (not entities, but referenced by business rules)

| Constant | Value (v1 default) | Notes |
|---|---|---|
| `BUFFER_MINUTES` | 15 | Fixed, system-wide (Q2=A) — not a `Service` field, not admin-editable in v1. Placeholder value pending the real groomer's input on actual cleanup time needed (flagged in requirements.md's "Open Items" spirit — this is exactly the kind of number that should be confirmed once the shop is live) |
| `SLOT_GRID_MINUTES` | 15 | Fixed grid interval for slot start times (Q3=A) |
| `ADVANCE_BOOKING_DAYS` | 14 | How far ahead availability is computed/shown (Q4=A) |
