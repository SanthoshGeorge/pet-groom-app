# Code Generation Plan — Pet Grooming Booking Platform

**Unit**: Pet Grooming Booking Platform (single unit, per `unit-of-work.md`)
**Workspace root** (from `aidlc-state.md`): `/root/petgroom-project/pet-groom-app` — application code goes here, never in `aidlc-docs/`
**Project type**: Greenfield single unit -> `src/`, `tests/`, `prisma/`, `config/` at workspace root, following `unit-of-work.md`'s module layout inside `src/`

This plan is the single source of truth for Code Generation. Every step below is traceable to a specific Functional Design, NFR, or Infrastructure Design artifact — nothing here introduces a new decision that wasn't already approved in an earlier stage.

## Unit Context

- **Stories implemented**: all 13 (`GC-1/2/3`, `RC-1/2/3`, `SO-1..6`) — full coverage confirmed in `unit-of-work-story-map.md`
- **Dependencies**: none external — single unit, no other units to coordinate with
- **Interfaces/contracts**: the 7 modules' method signatures from `component-methods.md`, as refined during Functional Design (notably: `createBooking` now takes per-pet service pairs, not one shared `serviceId`, per the `booking` pass's Question 1 resolution; `markNoShow` added, not in the original design)
- **Database entities owned**: all entities across all 7 modules' `*-domain-entities.md` files (Owner, Pet, Groomer, Service, AuthIdentity, Session, WorkingHoursRule, TimeOff, Appointment, AppointmentLineItem, ScheduledReminder)
- **Tech stack** (from `tech-stack-decisions.md`): Next.js 14+ (App Router) + TypeScript, Neon Postgres, hand-rolled auth, Resend (email), SMS stub, Vitest
- **One execution-level decision this plan makes that no earlier stage explicitly pinned down**: the ORM/database-access library. `tech-stack-decisions.md` specified Postgres but not an access layer. This plan uses **Prisma** — it generates TypeScript types directly from a schema that maps 1:1 onto the already-approved domain entities, has first-class Neon support (including pooled-connection handling), and its migration tooling directly satisfies the "Database Migration Scripts" step required below. This is called out explicitly so it's visible at approval time rather than silently decided.

## Plan

### Phase A — Project Structure Setup
- [x] **Step 1**: Scaffold the Next.js + TypeScript project at the workspace root (`src/app` for routes/pages, `src/modules` for business logic, `prisma/schema.prisma` for the data model, `tests/`, `config/`). Configure Vitest, ESLint/TypeScript strictness, and the folder layout from `unit-of-work.md`'s "Code Organization Strategy."
- [x] **Step 2**: Write `prisma/schema.prisma` covering every entity from all 7 modules' `*-domain-entities.md` files, including the slot-uniqueness constraint (NFR Design BR-AVAIL-5 resolution) and every field/enum/relationship already specified. This is the schema Business Logic Generation's types will be generated from.

### Phase B — Business Logic Generation (build order, per `unit-of-work.md`)
- [x] **Step 3**: `src/modules/auth/` — implement BR-AUTH-1..6 (`domain-entities.md`, `business-rules.md`, `business-logic-model.md` for auth/customer/catalog). Stories: RC-1 (registration/login portion).
- [x] **Step 4**: `src/modules/customer/` — implement BR-CUST-1..7. Stories: RC-1 (profile-linking portion).
- [x] **Step 5**: `src/modules/catalog/` — implement BR-CAT-1..5. Stories: SO-4.
- [x] **Step 6**: `src/modules/availability/` — implement BR-AVAIL-1..11 (availability pass's artifacts). Stories: GC-1, SO-5.
- [x] **Step 7**: `src/modules/booking/` — implement BR-BOOK-1..11, the `Appointment`/`AppointmentLineItem` status lifecycle, and `markNoShow`. Stories: GC-2, GC-3, RC-2, RC-3, SO-1, SO-2, SO-3.
- [x] **Step 8**: `src/modules/notification/` — implement BR-NOTIF-1..7 (fixed daily reminder time, immediate-send fallback, independent channels, `notificationFailed` flagging). Exercised by GC-2/RC-2/SO-2/GC-3/RC-3's notification criteria.
- [x] **Step 9**: `src/modules/reporting/` — implement BR-REPORT-1..4. Stories: SO-6.

### Phase C — Business Logic Testing
- [x] **Step 10**: Vitest unit tests for all 7 modules — one test file per module, covering every numbered business rule (BR-AUTH-*, BR-CUST-*, BR-CAT-*, BR-AVAIL-*, BR-BOOK-*, BR-NOTIF-*, BR-REPORT-*) as its own test case, plus the flows from each `*-business-logic-model.md`. Concurrency-sensitive rules (BR-AVAIL-5) get an explicit concurrent-request test.
- [x] **Step 11**: Business Logic Summary — a short `aidlc-docs/construction/pet-grooming-booking-platform/code/business-logic-summary.md` documenting what was generated, deviations (if any arose during implementation), and test coverage.

### Phase D — API Layer Generation (Next.js Route Handlers, `src/app/api/`)
- [x] **Step 12**: Public API routes — availability (`GET /api/availability`), booking (`POST /api/bookings`, `GET/POST /api/bookings/lookup`, `PATCH /api/bookings/:id` for cancel/reschedule), catalog (`GET /api/services`), auth (`POST /api/auth/login|logout|register|forgot-password|reset-password`), customer (`GET/PATCH /api/account/pets`).
- [x] **Step 13**: Admin API routes (all gated by `auth.validateSession`, `role=owner`, per every Functional Design pass's stated rule) — calendar/listing (`GET /api/admin/appointments`), booking on behalf of a customer (`POST /api/admin/bookings`, override variant), no-show marking (`POST /api/admin/appointments/:id/no-show`), catalog management (`POST/PATCH /api/admin/services`), working hours/time-off (`POST /api/admin/hours`, `POST /api/admin/time-off`), reports (`GET /api/admin/reports`).
- [x] **Step 14**: The cron-triggered reminder route (`POST /api/cron/reminders`), protected by the `CRON_SECRET` shared-secret header per Infrastructure Design.

### Phase E — API Layer Testing
- [x] **Step 15**: Integration tests (Vitest, against a test database) for every route in Steps 12-14 — request/response shape, auth gating on admin routes, and the guest-lookup security behavior (BR-BOOK-5's generic-error-either-way pattern) specifically verified.
- [x] **Step 16**: API Layer Summary — `aidlc-docs/construction/pet-grooming-booking-platform/code/api-layer-summary.md`.

### Phase F — Repository Layer Generation (`src/modules/*/repository.ts`, Prisma-backed)
- [x] **Step 17**: Data-access functions per module wrapping Prisma calls — including the specific patterns NFR Design specified: the insert-and-catch-constraint-violation pattern for `claimSlot`/`forceClaimSlot` (not a `SELECT...FOR UPDATE`), and the price/duration snapshot write in `booking`'s repository layer at appointment-creation time.

### Phase G — Repository Layer Testing
- [x] **Step 18**: Integration tests against a real (test) Postgres instance — particularly a concurrent-request test proving BR-AVAIL-5's atomicity guarantee actually holds against the real database, not just a mocked one.
- [x] **Step 19**: Repository Layer Summary — `aidlc-docs/construction/pet-grooming-booking-platform/code/repository-layer-summary.md`.

### Phase H — Frontend Components Generation
- [x] **Step 20**: Public site pages (`src/app/(public)/`) — home/landing, service menu, gallery, about/contact (FR-12), and the booking flow screens, built to match the already-approved mockup canvas (`Main.dc.html`, `Public-Booking.dc.html`, `Public-Details.dc.html`, `Public-Confirmation.dc.html`) pixel-and-copy-faithfully where the mockup covers a screen.
- [x] **Step 21**: Auth/account pages (`src/app/(public)/login`, `/signup`, `/account/pets`) — built from `frontend-components.md`'s component/prop/state specs (no mockup existed for these; this is their first visual implementation).
- [x] **Step 22**: Admin site pages (`src/app/(admin)/`) — calendar (`Admin-Calendar.dc.html`), new booking (`Admin-NewBooking.dc.html`), plus services management and reports pages from `frontend-components.md`'s specs (no mockup existed for these either).
- [x] **Step 23**: Every interactive element gets a stable `data-testid` per the Critical Rules' automation-friendly convention (`{component}-{element-role}` naming).

### Phase I — Frontend Components Testing
- [x] **Step 24**: Vitest + React Testing Library component tests — form validation (e.g. `ServiceForm`'s required-field rules from BR-CAT-5), conditional rendering (e.g. the `isOverride`/`hasConflict`/`notificationFailed` badges), and state transitions.
- [x] **Step 25**: Frontend Components Summary — `aidlc-docs/construction/pet-grooming-booking-platform/code/frontend-summary.md`.

### Phase J — Database Migration Scripts
- [x] **Step 26**: Generate the initial Prisma migration (`prisma migrate dev`) from the Step 2 schema — the actual SQL migration files, committed to `prisma/migrations/`.

### Phase K — Documentation & Deployment Artifacts
- [x] **Step 27**: `README.md` (setup instructions, environment variables per `deployment-architecture.md`'s table, how to run tests/migrations locally) and inline API documentation.
- [x] **Step 28**: Deployment artifacts — `vercel.json` (cron schedule for the reminder job, per NFR Requirements Q7/Infrastructure Design), `.env.example` (every variable from `deployment-architecture.md`'s table, no real values), and `package.json` scripts for build/test/migrate.

## Story Traceability Summary

| Story | Primary Module(s) | Plan Steps |
|---|---|---|
| GC-1 | availability | 6, 10, 12, 15, 20 |
| GC-2 | booking, notification | 7, 8, 10, 12, 15, 20 |
| GC-3 | booking, notification | 7, 8, 10, 12, 15, 20 |
| RC-1 | auth, customer | 3, 4, 10, 12, 21 |
| RC-2 | booking, notification | 7, 8, 10, 12, 20 |
| RC-3 | booking, notification | 7, 8, 10, 12, 20, 21 |
| SO-1 | booking | 7, 10, 13, 15, 22 |
| SO-2 | booking, notification | 7, 8, 10, 13, 22 |
| SO-3 | booking, availability | 6, 7, 10, 13, 22 |
| SO-4 | catalog | 5, 10, 13, 22 |
| SO-5 | availability | 6, 10, 13, 22 |
| SO-6 | reporting | 9, 10, 13, 22 |

**Total: 28 steps across 11 phases.** All 13 stories covered.
