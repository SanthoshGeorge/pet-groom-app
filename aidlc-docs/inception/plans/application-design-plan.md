# Application Design Plan — Pet Grooming Shop Booking App

Scope note: this stage identifies logical components, their responsibilities, and method-level interfaces — not detailed business logic (that's Functional Design, per-unit, in Construction) and not deployment/hosting decisions (that's NFR Requirements / Infrastructure Design).

## Execution Checklist

- [x] Step A: Finalize component boundaries based on answers below
- [x] Step B: Generate `components.md` — component definitions and responsibilities
- [x] Step C: Generate `component-methods.md` — method signatures per component
- [x] Step D: Generate `services.md` — service orchestration patterns
- [x] Step E: Generate `component-dependency.md` — dependency matrix and data flow
- [x] Step F: Generate `application-design.md` — consolidated summary of the above
- [x] Step G: Validate consistency across all artifacts
- [x] Step H: Present for review and approval

## Proposed Component Breakdown (for your review in the questions below)

Based on requirements.md and stories.md, the natural component boundaries appear to be:

1. **AvailabilityService** — computes open time slots (shop hours minus bookings minus buffers minus time off); owns groomer working-hours/time-off data (SO-5)
2. **BookingService** — creates, cancels, and reschedules appointments; handles guest bookings, account-holder bookings, owner-on-behalf bookings, multi-pet bookings, and owner overrides (SO-3); owns the concurrency-safe slot-claiming logic
3. **CustomerService** — owner and pet records; guest vs. account distinction; account creation (RC-1)
4. **NotificationService** — sends booking confirmations (email+SMS) and day-before SMS reminders, suppressed on cancellation (FR-10)
5. **CatalogService** — service list and pricing management (SO-4)
6. **ReportingService** — basic appointment/no-show counts (SO-6)

This is deliberately lean — no separate orchestration layer, no microservice-per-component assumption (that's a deployment question for later, not this stage).

---

## Questions

## Question 1 — Component breakdown
Does the 6-component breakdown above look right, or should it be adjusted?

A) Use it as proposed

B) Merge some further (fewer, more coarse-grained components — describe which after [Answer]: tag below)

C) Split some further (more, more fine-grained components — describe which after [Answer]: tag below)

X) Other (please describe after [Answer]: tag below)

[Answer]: A
## Question 2 — Pet as sub-entity vs. own component
Should Pet records be owned by CustomerService as a sub-entity of Owner (no independent lifecycle — a pet always belongs to an owner), or should Pet be its own component?

A) Sub-entity of CustomerService (recommended — pets have no meaning without an owner)

B) Separate PetService component

X) Other (please describe after [Answer]: tag below)

[Answer]: A
## Question 3 — Authentication boundary
Both shop-owner login (for the admin view) and optional customer account login (RC-1) need authentication. Should this be its own component, or folded into CustomerService?

A) Dedicated AuthService component, used by both shop owner and customer account login

B) Folded into CustomerService (no separate component)

X) Other (please describe after [Answer]: tag below)

[Answer]: A
## Question 4 — Orchestration pattern
When a booking is created, several components need to be involved (check availability, create the appointment, trigger notifications). Should there be a dedicated orchestrating component, or should BookingService itself directly call the others it needs?

A) BookingService directly coordinates AvailabilityService, CustomerService, and NotificationService (recommended — no extra layer needed at this scale)

B) A separate BookingOrchestrator component coordinates the others, keeping BookingService itself narrower

X) Other (please describe after [Answer]: tag below)

[Answer]: A
## Question 5 — Guest booking lookup (for cancellation)
GC-3 requires a guest to look up their appointment (e.g., via a booking reference + contact info) to cancel/reschedule without an account. Should this lookup live inside BookingService, or be its own small component?

A) Part of BookingService (recommended — it's just another operation on the same appointment data)

B) Separate BookingLookupService component

X) Other (please describe after [Answer]: tag below)

[Answer]: A
---

**Note**: Deployment architecture (single app vs. separate services, hosting choice, database choice) is intentionally out of scope here — that's decided in NFR Requirements / Infrastructure Design, once we know what these components actually need.
