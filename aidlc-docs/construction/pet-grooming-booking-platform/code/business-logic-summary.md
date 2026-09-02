# Business Logic Summary

**Unit**: Pet Grooming Booking Platform
**Scope**: Code Generation Phase B (Business Logic Generation, Steps 3-9) and Phase C (Business Logic Testing, Step 10), summarized here per Step 11.

---

## What was generated

All 7 modules specified by `unit-of-work.md` were implemented under `src/modules/`, each a pure-TypeScript business-logic layer with zero Prisma/database import — every module depends only on its own `repository.ts` abstraction (an interface, no implementation), so the whole business-logic layer compiles and is fully testable before the Prisma client exists (it is intentionally not generated yet — Phase F, Step 17, wires the real Postgres-backed repositories behind these same interfaces).

| Module | Build step | Business rules implemented | Source (`src/modules/<name>/`) |
|---|---|---|---|
| `auth` | 3 | BR-AUTH-1..6 | `service.ts`, `repository.ts`, `types.ts`, `errors.ts`, `validation.ts`, `password.ts`, `reset-token.ts`, `index.ts` (506 lines) |
| `customer` | 4 | BR-CUST-1..7 | `service.ts`, `repository.ts`, `types.ts`, `errors.ts`, `validation.ts`, `index.ts` (368 lines) |
| `catalog` | 5 | BR-CAT-1..5 | `service.ts`, `repository.ts`, `types.ts`, `errors.ts`, `validation.ts`, `index.ts` (197 lines) |
| `availability` | 6 | BR-AVAIL-1..11 | `service.ts`, `repository.ts`, `types.ts`, `errors.ts`, `validation.ts`, `time.ts`, `config.ts`, `index.ts` (739 lines) |
| `booking` | 7 | BR-BOOK-1..11 + the Appointment/AppointmentLineItem status lifecycle + `markNoShow` | `service.ts`, `repository.ts`, `types.ts`, `errors.ts`, `validation.ts`, `status.ts`, `id.ts`, `reference.ts`, `index.ts` (847 lines) |
| `notification` | 8 | BR-NOTIF-1..7 | `service.ts`, `repository.ts`, `types.ts`, `senders.ts`, `time.ts`, `config.ts`, `index.ts` (428 lines) |
| `reporting` | 9 | BR-REPORT-1..4 | `service.ts`, `repository.ts`, `types.ts`, `errors.ts`, `validation.ts`, `time.ts`, `index.ts` (143 lines) |

**Total: 3,228 lines across the 7 modules.**

### Dependency shape (matches the build order above)

`booking` is the hub: it depends directly on the real `CustomerService`, `CatalogService`, and `AvailabilityService` (all built before it, Steps 4-6), plus a locally-defined minimal `NotificationCollaborator` structural interface for the not-yet-built `notification` (Step 8) — the same pattern `auth` uses for `customer` via its `OwnerIdentityResolver`, necessary only when the real dependency doesn't exist yet at build time. `notification` (built after `booking`) imports `booking`'s real `AppointmentWithLineItems` type directly and its `NotificationService` structurally satisfies `booking`'s `NotificationCollaborator` — no adapter needed, verified by the composition wiring in `tests/modules/booking.test.ts`. `reporting` depends on nothing but its own repository (it reads the booking-owned `Appointment` table directly at the data layer, not through `booking`'s service). Two cross-module writes exist by design, mirroring each other: `availability` identifies (but does not itself set) `Appointment.flaggedForReview`, delegating the actual write to `booking.flagAppointmentsForReview`; `notification` writes `Appointment.notificationFailed` directly via its own repository's `markAppointmentNotificationFailed`. Both are documented at each call site.

## Deviations / judgment calls

No requirement was silently reinterpreted. A handful of small, unavoidable decisions were made where an earlier-stage artifact left a genuine gap, and each is documented inline at its exact call site (grep `JUDGMENT CALL` under `src/modules/` to find all of them) rather than only here:

- **`booking.createBooking`/`createOverrideBooking` take one `CreateBookingInput` object, not `component-methods.md`'s original positional signature.** This is a direct, mechanical consequence of an already-approved change: `booking-domain-entities.md`'s Q1=A resolution already requires per-pet service selection (`petServicePairs[]` instead of one shared `serviceId`), and a 5+ positional-argument function with one argument now itself a structured array is exactly the shape that becomes a single input object — not a new, independent decision (`src/modules/booking/service.ts`).
- **`Appointment.id` is pre-generated client-side (`randomUUID()`)**, not left to Prisma's `@default(cuid())`, because `availability.claimSlot` needs an id to correlate against *before* the Appointment row is written (Flow 1 claims the slot at step 5, persists at step 6). Prisma accepts an explicit `id` on `create()` exactly as it does its own default, so this needed no schema change (`src/modules/booking/id.ts`).
- **`bookingReference`'s `"HTG"` prefix** is the same placeholder-pending-real-branding shop-initials value already used in the mockup and NFR-2's own example (`HTG-4821`), kept literally rather than invented (`src/modules/booking/reference.ts`).
- **No shop timezone has been specified by any artifact.** `availability`, `notification`, and `reporting` all do their date/time-of-day arithmetic in UTC (`getUTC*`/`setUTC*`) rather than the host process's local timezone, so slot-grid/reminder/report-period computation is deterministic regardless of where the code runs. Treat every `Date` in these modules as "shop wall-clock time stored using UTC field accessors" — real shop-local-timezone handling is flagged as a later, explicitly out-of-scope concern, not silently assumed away (`src/modules/availability/time.ts`, duplicated in spirit by `src/modules/notification/time.ts` and `src/modules/reporting/time.ts`).
- **No minimum password-strength rule exists in any Functional Design or NFR artifact.** An 8-character minimum is applied as the "sensible practices" floor NFR-4 asks for generally, cheap to change later without touching anything else (`src/modules/auth/validation.ts`).
- **Password-reset tokens are stateless (HMAC-SHA256 over `{identityId, expiresAt}`, keyed with the current `passwordHash` plus a server secret), not a stored `PasswordResetToken` row.** No such entity exists in `domain-entities.md` or `prisma/schema.prisma` (unlike `notification`'s `ScheduledReminder`, which was explicitly modeled as a table for the same need), and modifying the schema was out of this step's scope (locked at Step 2). The stateless design gets every property BR-AUTH-3/Flow 4 requires — expiry, single-use (invalidated the instant the password it's keyed to changes), no new table (`src/modules/auth/reset-token.ts`).
- **`availability`'s `isSlotAvailable`/`claimSlot`/`forceClaimSlot` take a `SlotRequest` (`{start, durationMinutes}`) instead of `component-methods.md`'s literal `(slot, serviceId)`.** `availability-business-logic-model.md`'s own Cross-Module Notes already establish that `booking` sums each pet's line-item duration before calling in — a single `serviceId` can't represent a multi-pet visit's several different durations, so the already-approved multi-pet flow required this (`src/modules/availability/service.ts`).
- **`notification`'s SMS channel is genuinely unable to fail in v1**, a direct and accepted consequence of Q6=B's "stub/log-only" decision, not something silently assumed: `createLogOnlySmsSender` logs the full message and never rejects. Swapping in a real provider later is a config change behind the same `SmsSender` interface — no change to business logic (`src/modules/notification/senders.ts`).

None of these required revisiting or re-litigating an already-answered Functional Design question; each is a mechanical fill-in for a gap that question resolution left open.

## Test coverage (Step 10)

One Vitest file per module under `tests/modules/`, each backed by hand-written in-memory fake repository implementations under `tests/fakes/` (no real database anywhere in this suite — Prisma client generation is blocked in this environment until Step 17). **156 tests, 8 files, all passing** (`npx vitest run`); `npx tsc --noEmit` and `npx eslint .` both report zero errors/warnings across the whole project.

| Test file | Tests | Business rules covered | Fakes used |
|---|---|---|---|
| `tests/setup.smoke.test.ts` | 1 | — (Vitest scaffold smoke test, Step 1) | — |
| `tests/modules/auth.test.ts` | 19 | BR-AUTH-1..6 + Flows 2/3/4 | `auth.fake.ts` + the REAL `CustomerService` (on `customer.fake.ts`) as `identityResolver` |
| `tests/modules/customer.test.ts` | 23 | BR-CUST-1..7 + Flows 1/5 | `customer.fake.ts` |
| `tests/modules/catalog.test.ts` | 13 | BR-CAT-1..5 + Flow 6 | `catalog.fake.ts` |
| `tests/modules/availability.test.ts` | 26 | BR-AVAIL-1..11 (all 6 flows) + **explicit BR-AVAIL-5 concurrent-request test** | `availability.fake.ts` + the REAL `CatalogService` (on `catalog.fake.ts`) |
| `tests/modules/booking.test.ts` | 44 | BR-BOOK-1..11 (all 7 flows, incl. `markNoShow`) + the status auto-complete lifecycle | `booking.fake.ts` + the REAL `CustomerService`/`CatalogService`/`AvailabilityService`/`NotificationService`, each on its own fresh fake repository |
| `tests/modules/notification.test.ts` | 22 | BR-NOTIF-1..7 (all 5 flows) + **per-reminder batch-failure-isolation test** | `notification.fake.ts` + the REAL `CustomerService` (on `customer.fake.ts`) |
| `tests/modules/reporting.test.ts` | 8 | BR-REPORT-1..4 | `reporting.fake.ts` |
| **Total** | **156** | every numbered BR across all 7 modules | 7 fake repositories |

### Every numbered business rule has its own `describe` block and at least one dedicated test case

- **BR-AUTH-1..6** — session-optional booking, immediate account activation, self-service password recovery (with single-use, session-invalidating reset tokens), browser-session-only sessions (including a defensive past-`expiresAt` check), the two-role model, and the owner login's `ownerId = null` invariant.
- **BR-CUST-1..7** — email-then-phone owner matching with additive (non-destructive) field updates, the email-wins ambiguous-match tie-break, account linking, unrestricted multi-pet counts, fixed pet-size categories, and owner/pet data always being shop-visible regardless of account-linked status.
- **BR-CAT-1..5** — active-only bookability, non-destructive deactivation (history preserved), live-row-only price/duration edits, no in-place price-history table, and required-field validation on creation.
- **BR-AVAIL-1..11** — sequential multi-pet duration, the fixed system-wide buffer, the slot grid, the 14-day advance-booking clamp, **an explicit concurrent-`claimSlot` race test proving exactly one of many simultaneous callers wins (BR-AVAIL-5)**, the generic no-auto-suggestion failure error (BR-AVAIL-6), the 7-day working-hours schedule requirement, whole-day-only time off, non-cancelling appointment-flagging on hours/time-off changes, override-conflict semantics, and unconditional slot release.
- **BR-BOOK-1..11** — per-pet service selection with independent price/duration snapshots, the read-time status auto-complete plus the Completed-only `markNoShow` gate, identity-preserving reschedule (claim-new-before-release-old ordering, verified to leave the original untouched on failure), whole-appointment (never partial) cancel, exact-reference-plus-contact-match guest lookup with a single generic not-found error either way, the terminal-state protection matrix (cancel/reschedule rejected from Completed/Cancelled/NoShow), visit-notes independence from a pet's permanent notes, the `HTG-####` reference format with transparent collision-retry, cancellation notifications always reaching the customer of record regardless of actor, reminder re-sync on reschedule, and identical notification treatment for override bookings — **plus confirmation that a `SlotNotAvailableError` from `availability.claimSlot` propagates correctly as `booking`'s own error, without re-testing `availability`'s own atomicity (already covered by `availability.test.ts`'s BR-AVAIL-5 test).**
- **BR-NOTIF-1..7** — the fixed daily send time, the short-notice immediate-send fallback, independent email/SMS channels (one failing never blocks or retries the other), the `notificationFailed` flag (including a defensive missing-Owner case), reminder cancellation (including its two legitimate no-op cases — already-`Sent` and already-sent-immediately), reschedule re-sync, and confirmation/cancellation sends always being immediate, never batched — **plus a daily-batch test proving one reminder's own processing failure doesn't abort the rest of the batch, and a due-reminder-filtering test (Pending + `sendAt <= now` only, excluding Cancelled/Sent/future-dated rows).**
- **BR-REPORT-1..4** — the two accepted preset periods only (with a rejection test for anything else), correct Monday-Sunday/calendar-month half-open range boundaries, appointment totals inclusive of every status including Cancelled, no-show counts scoped correctly to status and period, and the exact two-field output shape.

### Notable findings while reviewing the other 4 modules' tests (for this summary)

- `auth.test.ts` and `availability.test.ts` already established the two conventions this pass's 3 new test files (`booking`, `notification`, `reporting`) follow: (1) wire in a collaborator module's *real* service on top of a fresh fake repository, rather than re-mocking it, whenever the composition root would do the same (`auth` -> real `customer`; `availability` -> real `catalog`); (2) give concurrency-sensitive rules their own explicit race test, not just a description in prose. `booking.test.ts` extends convention (1) the furthest — it wires in all four of its real collaborators (`customer`, `catalog`, `availability`, `notification`) at once, each on its own fresh fake repository, so the suite exercises the actual cross-module wiring (including the `notification` → `booking` cross-module `notificationFailed` write, via a small test-only hook exposed by `tests/fakes/booking.fake.ts`) rather than isolated units.
- `availability.fake.ts`'s `claimSlot` reproduces the real (not-yet-built) Prisma unique-constraint race with a deliberate `await`-then-atomic-synchronous-check pattern — worth preserving as the reference implementation for any future fake that needs to simulate DB-level atomicity.
- All 4 existing test files (plus the Step 1 smoke test) were left completely untouched, and all 82 of their pre-existing test cases still pass unmodified alongside the 74 new ones added in this pass (44 + 22 + 8 for `booking`/`notification`/`reporting`) — full-suite count: **156**.

## Verification

```
npx vitest run     # 156 passed, 156 total (8 test files)
npx tsc --noEmit    # zero errors
npx eslint .         # zero errors, zero warnings
```
