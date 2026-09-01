# Application Design — Consolidated Summary

**Pet Grooming Shop Booking App**

This consolidates `components.md`, `component-methods.md`, `services.md`, and `component-dependency.md`. All decisions below were confirmed by the user in `aidlc-docs/inception/plans/application-design-plan.md` (all 5 recommended options accepted).

## Components (7)

| Component | Role |
|---|---|
| **AuthService** | Shop owner login (always) + optional customer account login |
| **CustomerService** | Owner + Pet records (Pet is a sub-entity, no independent lifecycle) |
| **CatalogService** | Service menu and pricing |
| **AvailabilityService** | Open-slot computation; owns working hours/time off |
| **BookingService** | The hub — owns the full appointment lifecycle, coordinates the others directly (no separate orchestrator) |
| **NotificationService** | Email/SMS confirmations + day-before SMS reminders |
| **ReportingService** | Basic appointment/no-show counts |

Full responsibilities and interfaces: see `components.md`. Method-level signatures: see `component-methods.md`.

## Orchestration

No dedicated orchestration layer — BookingService is the natural coordination point since it already owns appointments, and every other user action maps to a single component directly. Full flow-by-flow detail (one flow per user story): see `services.md`.

## Dependencies

```
CatalogService, AuthService  <-- foundational, few/no dependencies
        |
AvailabilityService (needs CatalogService for service duration)
        |
BookingService (coordinates Availability, Customer, Notification, Auth)
        |
ReportingService (reads Booking's data)

NotificationService <-- leaf, no dependents
```

Full matrix and diagram: see `component-dependency.md`.

## What This Stage Deliberately Did Not Decide

Per this stage's scope (logical design, not implementation or deployment):
- **Detailed business logic** (e.g., the exact concurrency-safe mechanism behind `AvailabilityService.claimSlot`) — comes in **Functional Design**, per unit, in Construction.
- **Tech stack** (language, framework, database) — comes in **NFR Requirements**.
- **Deployment architecture** (one app vs. separate services, hosting, how the day-before reminder gets triggered — cron vs. queue) — comes in **Infrastructure Design**.

## Traceability to Stories

Every story in `stories.md` maps to at least one component method:
- **GC-1/RC-1** (view availability) → AvailabilityService
- **GC-2/RC-2/SO-2** (book) → BookingService, coordinating CustomerService, AvailabilityService, NotificationService
- **GC-3/RC-3** (cancel/reschedule) → BookingService, releasing back to AvailabilityService, notifying via NotificationService
- **RC-1** (create account) → AuthService + CustomerService
- **SO-1** (calendar) → BookingService
- **SO-3** (override) → BookingService + AvailabilityService's force-claim path
- **SO-4** (services/prices) → CatalogService
- **SO-5** (working hours) → AvailabilityService
- **SO-6** (reports) → ReportingService
