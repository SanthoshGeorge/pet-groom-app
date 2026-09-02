# Domain Entities — booking

**Unit**: Pet Grooming Booking Platform
**Scope**: entities owned by the `booking` module — the hub of the system. References `Owner`/`Pet` (customer), `Service` (catalog), `Groomer` (customer), and the availability-check mechanism (availability), all already defined in their own passes.

## Entity Summary

| Entity | Purpose |
|---|---|
| `Appointment` | One visit — the booking itself: who, when, status, how it was created |
| `AppointmentLineItem` | One pet + the service it's getting, within an `Appointment` (Q1=A — per-pet service selection) |

## Appointment

| Field | Type | Notes |
|---|---|---|
| `id` | id | primary key |
| `bookingReference` | string | unique, shop-prefixed short code (e.g. `HTG-4821`) — Q7=A. Used for guest lookup (GC-3). Generated at creation; regenerated on the rare collision. |
| `ownerId` | id (FK -> Owner) | who this visit is for |
| `groomerId` | id (FK -> Groomer) | auto-assigned (FR-2 — only one exists today) |
| `slotStart` | timestamp | |
| `slotEnd` | timestamp | `slotStart` + sum of all line items' `durationSnapshotMinutes` (per `availability`'s BR-AVAIL-1) |
| `status` | enum: `Booked` \| `Completed` \| `Cancelled` \| `NoShow` | see lifecycle below |
| `createdBy` | enum: `guest` \| `account` \| `owner` | who initiated it — GC-2/RC-2/SO-2 use the same underlying flow, differing only here |
| `isOverride` | boolean | true if created via `createOverrideBooking` and it fell outside normal hours/buffer/time-off (SO-3) — drives the mockup's "OVERRIDE" badge |
| `hasConflict` | boolean | true if an override created it while overlapping another appointment (SO-3's warned-but-confirmed case) |
| `flaggedForReview` | boolean | true if a later working-hours/time-off change orphaned this appointment (`availability`'s BR-AVAIL-9) — surfaced to the owner on the admin calendar, same visual language as `isOverride` |
| `visitNotes` | string, optional | this-visit-only note (Q6=A) — separate from any pet's permanent notes |
| `cancelledAt` | timestamp, nullable | set when `status` becomes `Cancelled` |
| `cancelledBy` | enum: `guest` \| `account` \| `owner`, nullable | who cancelled it |
| `createdAt` | timestamp | |

**Relationships**: `Appointment 1 --- * AppointmentLineItem`. `Appointment * --- 1 Owner`. `Appointment * --- 1 Groomer`.

## AppointmentLineItem

| Field | Type | Notes |
|---|---|---|
| `id` | id | primary key |
| `appointmentId` | id (FK -> Appointment) | |
| `petId` | id (FK -> Pet) | |
| `serviceId` | id (FK -> Service) | |
| `priceSnapshot` | decimal | copied from `Service.price` at booking time (BR-CAT-4) |
| `durationSnapshotMinutes` | integer | copied from `Service.durationMinutes` at booking time |

**Note (Q1=A)**: this is the resolution to the Question 1 conflict — each pet in a visit gets its own line item with its own service, price, and duration. A single-pet booking simply has one `AppointmentLineItem`. `createBooking`'s signature (currently `createBooking(ownerInfo, pets[], serviceId, slot, createdBy)` in `component-methods.md`) needs to change to pair each pet with its own `serviceId` — e.g. `createBooking(ownerInfo, petServicePairs[], slot, createdBy)` — flagged here for Code Generation; not re-litigated in this pass since the business decision (per-pet services) is now settled.

## Status Lifecycle

```
Booked --(slot end time passes, no owner action)--> Completed
Booked --(customer or owner cancels)--> Cancelled
Booked --(owner overrides into a conflicting slot, confirmed anyway)--> Booked (unchanged - hasConflict=true is set at creation, not a transition)
Completed --(owner explicitly marks no-show)--> NoShow    [Q2=A - the one exception:
                                                             Completed is not fully terminal]
Cancelled, NoShow --> (terminal, no further transitions)
```

- `Completed` and `Cancelled` and `NoShow` appointments cannot be rescheduled or re-cancelled (GC-3/RC-3's "already occurred" edge case — attempting it returns an error, doesn't silently fail).
- Marking `NoShow` is a new admin-only action (`markNoShow(appointmentId)`) not present in `component-methods.md` — added here per Q2=A; only valid from `Completed` (i.e., only after the slot has actually passed — an upcoming `Booked` appointment can't be pre-emptively marked a no-show).
- No "undo" for `markNoShow` is defined in this pass — not raised by any of the 8 questions, and no story requires reversing it; flagged as an open item, not a blocker.
