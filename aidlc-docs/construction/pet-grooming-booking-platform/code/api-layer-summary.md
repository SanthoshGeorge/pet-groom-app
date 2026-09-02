# API Layer Summary

**Unit**: Pet Grooming Booking Platform
**Scope**: Code Generation Phase D (API Layer Generation, Steps 12-14) and Phase E (API Layer Testing, Step 15), summarized here per Step 16.

---

## What was generated

21 Next.js Route Handler endpoints across 20 `route.ts` files under `src/app/api/` (1,058 lines), fronting all 7 business-logic modules built in Phase B. Every route follows one shared convention, established at Step 12 and reused without exception through Steps 13-14:

- **Composition root**: every route calls `getServices()` (`src/server/container.ts`) to obtain its module's service instance — never constructs one itself.
- **Success responses**: `jsonOk(payload)` (200) or `jsonCreated(payload)` (201), always `{ <resourceName>: ... }`, never a bare array/value (`src/server/http.ts`).
- **Failure responses**: a single `try { ... } catch (err) { return errorToResponse(err); }` block per handler. `errorToResponse` maps a thrown error's `.name` to an HTTP status via one shared lookup table, so no route needs to `instanceof`-check a specific module's error classes.
- **Input validation**: manual, per-route (no schema-validation library, per NFR Design's Security Patterns Q5=B) — `readJsonBody` turns malformed/non-object JSON into a 400 uniformly; each route hand-checks its own required fields beyond that.
- **Admin auth gating**: every `src/app/api/admin/**` route calls `requireOwnerSession()` (`src/server/session.ts`) as its first line inside the `try` block — 401 when there's no session at all, 403 when a real session exists but `role !== "owner"`.
- **Cron auth gating**: the one `src/app/api/cron/**` route uses a distinct, session-free mechanism — a shared-secret `Authorization: Bearer <CRON_SECRET>` header check, matching Vercel Cron's own documented automatic-header behavior.

### The 21 endpoints

| # | Method + Path | Step | Module(s) | Route file |
|---|---|---|---|---|
| 1 | `GET /api/availability` | 12 | availability | `src/app/api/availability/route.ts` |
| 2 | `POST /api/bookings` | 12 | booking | `src/app/api/bookings/route.ts` |
| 3 | `POST /api/bookings/lookup` | 12 | booking | `src/app/api/bookings/lookup/route.ts` |
| 4 | `PATCH /api/bookings/:id` | 12 | booking | `src/app/api/bookings/[id]/route.ts` |
| 5 | `GET /api/services` | 12 | catalog | `src/app/api/services/route.ts` |
| 6 | `POST /api/auth/login` | 12 | auth | `src/app/api/auth/login/route.ts` |
| 7 | `POST /api/auth/logout` | 12 | auth | `src/app/api/auth/logout/route.ts` |
| 8 | `POST /api/auth/register` | 12 | auth | `src/app/api/auth/register/route.ts` |
| 9 | `POST /api/auth/forgot-password` | 12 | auth | `src/app/api/auth/forgot-password/route.ts` |
| 10 | `POST /api/auth/reset-password` | 12 | auth | `src/app/api/auth/reset-password/route.ts` |
| 11 | `GET /api/account/pets` | 12 | customer | `src/app/api/account/pets/route.ts` |
| 12 | `PATCH /api/account/pets` | 12 | customer | `src/app/api/account/pets/route.ts` |
| 13 | `GET /api/admin/appointments` | 13 | booking | `src/app/api/admin/appointments/route.ts` |
| 14 | `POST /api/admin/bookings` | 13 | booking | `src/app/api/admin/bookings/route.ts` |
| 15 | `POST /api/admin/appointments/:id/no-show` | 13 | booking | `src/app/api/admin/appointments/[id]/no-show/route.ts` |
| 16 | `POST /api/admin/services` | 13 | catalog | `src/app/api/admin/services/route.ts` |
| 17 | `PATCH /api/admin/services/:id` | 13 | catalog | `src/app/api/admin/services/[id]/route.ts` |
| 18 | `POST /api/admin/hours` | 13 | availability + booking | `src/app/api/admin/hours/route.ts` |
| 19 | `POST /api/admin/time-off` | 13 | availability + booking | `src/app/api/admin/time-off/route.ts` |
| 20 | `GET /api/admin/reports` | 13 | reporting | `src/app/api/admin/reports/route.ts` |
| 21 | `POST /api/cron/reminders` | 14 | notification | `src/app/api/cron/reminders/route.ts` |

Endpoints 18 and 19 each call two modules directly: `availability.setWorkingHours`/`addTimeOff` *identifies* appointments a schedule change orphans (`affectedAppointmentIds`), and the route itself is the caller that forwards those ids to `booking.flagAppointmentsForReview` (BR-AVAIL-9) — the cross-module wiring point `availability-business-logic-model.md`'s Cross-Module Notes anticipated but left for "a future admin route" to actually perform.

## The composition-root / placeholder-repository decision (Step 12)

Prisma's CLI cannot run in this build environment (egress to `binaries.prisma.sh` is blocked), so `@prisma/client` has no generated types anywhere in this codebase, and the real Prisma-backed repository implementations (Phase F, Step 17) do not exist yet. Every module's business logic already depends only on its own repository *interface*, never on Prisma directly, so it compiles and unit-tests fine without a database (Steps 3-10) — but the routes built starting at Step 12 still need actual, constructed service instances to call into.

`src/server/container.ts` resolves that gap: it builds each `createXService(...)` against a **placeholder repository** — a generic `Proxy` (`createPlaceholderRepository<T>`) whose every method throws a descriptive "not wired to a database yet" error instead of touching Postgres — plus a placeholder `EmailSender` for the same reason (no real Resend wiring exists yet either; SMS already has a real log-only implementation per Q6=B). This lets every route in the codebase compile, type-check, and be *called* against the real service interfaces right now; only actually invoking a repository method at runtime throws, until Step 17 swaps each placeholder construction for a real `createPrismaXRepository(prisma)` call. Nothing under `src/app/api/**` needs to change when that happens — every route already calls through `getServices()` against the same `Services` interface either way. `reporting` was added to the `Services` interface at Step 13 (Step 12 had no public route that needed it).

## The test-database deviation (Step 15)

The plan's Step 15 wording calls for integration tests "against a test database." No such database is available in this container for the same reason `container.ts`'s placeholder repositories exist — Prisma client generation is blocked — and the real Postgres-backed repository layer this would otherwise sit on (Step 17) doesn't exist yet either. Real-Postgres integration testing is explicitly Step 18's job, scoped to the repository layer specifically, once Step 17 has built it.

**The adaptation used instead**: `tests/api/**` integration-tests the actual route handler functions — imported and invoked directly, with real `Request`/`NextRequest` objects and Next 16's real async `params` shape — wired through the same composition root (`getServices()`) to **real service instances built on Step 10's in-memory fake repositories** (`tests/fakes/*.fake.ts`), via a small test-only override hook added to `container.ts`:

```ts
export function __setServicesForTesting(overrides: Partial<Services> | Services): void
export function __resetServicesForTesting(): void
```

`getServices()` checks for an installed override before falling back to the real (placeholder-backed) singleton, so every route handler keeps its normal `import { getServices } from "@/server/container"` — nothing under `src/app/api/**` changes for this. This exercises the full real stack — HTTP parsing, manual validation, auth gating, service composition, real business logic, "persistence" — short of an actual SQL database. Two further pieces of shared test infrastructure make this practical:

- **`tests/api/test-helpers/build-test-services.ts`** — mirrors `container.ts`'s `buildServices()` wiring exactly, but on Step 10's fakes instead of throwing placeholders, plus a simple in-memory tracking `EmailSender` (records every message, never fails) instead of a real provider. Returns a `TestServicesBundle` exposing the real services, their backing fake repositories (for direct seeding/assertion — e.g. `bundle.repos.reporting._appointments.push(...)`, `bundle.repos.booking._appointments.get(id)`), the email tracker, and `setAllDayHours()`/`setWorkingHours()` conveniences.
- **`tests/api/test-helpers/fake-next-headers.ts`** — a `vi.mock` of `next/headers`'s `cookies()`. Next's real `cookies()` only works inside the request-scoped async context Next's own server sets up around a route handler's execution; calling a route handler directly (as every `tests/api/**` file does) throws "`cookies` was called outside a request scope" without this. Every test file whose routes touch the session cookie imports this module first, then uses `resetFakeCookieJar`/`seedCookie`/`readFakeCookie` to simulate an incoming cookie and assert on `setSessionCookie`/`clearSessionCookie` calls directly (asserting a real `Set-Cookie` response header isn't meaningful when a handler is invoked as a bare function, outside Next's server).
- **`tests/api/test-helpers/request.ts`** — `jsonRequest`/`nextGetRequest`/`malformedJsonRequest` builders for constructing real `Request`/`NextRequest` objects.

No route file and no business-logic module changed to accommodate this — the only change to production code is the additive test-hook block appended to the bottom of `container.ts` (clearly marked, never imported from anywhere under `src/`).

**A second, narrower deviation surfaced while writing this phase's admin-services tests**, worth recording rather than silently working around: `PATCH /api/admin/services/:id` always constructs its `catalog.updateService` call with all three optional fields present as object keys (`{ name: body.name, price: body.price, durationMinutes: body.durationMinutes }`), even when the caller supplied only one. A real Prisma `update({ data })` call treats an explicitly-`undefined`-valued key as "leave this column alone" — but Step 10's `tests/fakes/catalog.fake.ts` (`updateService`) does a naive `{...existing, ...fields}` merge, which does *not* have that Prisma-specific skip-undefined behavior, so on the fake a partial `{ price: 35 }` PATCH clobbers `name`/`durationMinutes` to `undefined` (dropped entirely by `NextResponse.json`'s serialization). This is a fake-vs.-eventual-real-repository behavior gap, not a route bug — the route's own object-construction shape is exactly what the real Prisma layer (Step 17) needs to correctly express "leave the other fields alone." `tests/api/admin-services.test.ts`'s partial-update test therefore only asserts the field it actually changed (`price`), not that untouched fields survive, to stay accurate to current (fake-backed) observable behavior; Step 17/18 should re-verify partial-update semantics once the real repository exists.

## Test coverage (Step 15)

**262 tests across 18 files, all passing** (`npx vitest run`); `npx tsc --noEmit` and `npx eslint .` both report zero errors/warnings across the whole project. 51 tests (5 files) cover the 12 public routes (Step 12); 55 tests (5 files, this pass) cover the 8 admin routes + 1 cron route (Steps 13-14); the remaining 156 tests are the pre-existing Step 10 business-logic suite, untouched.

| Test file | Tests | Routes covered | Auth-gating asserted |
|---|---|---|---|
| `tests/api/public-auth.test.ts` | 15 | `POST /api/auth/{register,login,logout,forgot-password,reset-password}` | — (no session required on any of these) |
| `tests/api/public-availability.test.ts` | 5 | `GET /api/availability` | — (public) |
| `tests/api/public-services.test.ts` | 2 | `GET /api/services` | — (public) |
| `tests/api/public-account.test.ts` | 9 | `GET/PATCH /api/account/pets` | 401 with no session; 401 for a non-customer (owner) session; 200/201 for a valid customer session |
| `tests/api/public-bookings.test.ts` | 20 | `POST /api/bookings`, `POST /api/bookings/lookup`, `PATCH /api/bookings/:id` | session-optional (guest path via bookingReference+contact) vs. session-based (customer/owner) actor resolution on `PATCH`; owner session can act on any appointment |
| `tests/api/admin-appointments.test.ts` | 19 | `GET /api/admin/appointments`, `POST /api/admin/bookings`, `POST /api/admin/appointments/:id/no-show` | 401 no session / 403 role=customer / 200-201 owner, on all three routes |
| `tests/api/admin-services.test.ts` | 12 | `POST /api/admin/services`, `PATCH /api/admin/services/:id` | 401 no session / 403 role=customer / 201-200 owner, on both routes |
| `tests/api/admin-hours-timeoff.test.ts` | 12 | `POST /api/admin/hours`, `POST /api/admin/time-off` | 401 no session / 403 role=customer / 200-201 owner, on both routes |
| `tests/api/admin-reports.test.ts` | 6 | `GET /api/admin/reports` | 401 no session / 403 role=customer / 200 owner |
| `tests/api/cron-reminders.test.ts` | 6 | `POST /api/cron/reminders` | 401 missing header / 401 wrong secret / 401 wrong scheme / 401 secret unconfigured / 200 correct secret |
| **Total (this file's scope, Steps 13-14)** | **55** | 8 admin routes + 1 cron route | every admin route: 401 + 403 + success; cron route: 4 distinct 401 cases + success |
| **Grand total (Step 15, Steps 12-14)** | **106** | all 21 routes | — |

### What each area specifically verifies

- **Request/response shape** — every route has at least one test asserting the exact success-response envelope (`{ appointment }`, `{ services }`, `{ workingHours, affectedAppointmentIds }`, `{ result }`, etc.) and status code (200 vs. 201 vs. 400/401/403/404/409), matching `http.ts`'s documented conventions.
- **Admin auth gating (Step 15's explicit call-out)** — every one of the 8 admin routes has three dedicated cases: no session cookie at all → 401; a real, valid session whose role is `"customer"` → 403 (never conflated with "not authenticated"); a valid `role: "owner"` session → the route's normal success path. `tests/api/admin-*.test.ts` construct an owner session directly against the fake auth repository (`bundle.repos.auth.createIdentity({..., role: "owner"})` + `createSession`), the same pattern `public-account.test.ts`/`public-bookings.test.ts` already established for the public routes' owner-privilege cases.
- **Cron secret gating** — `tests/api/cron-reminders.test.ts` covers all four failure shapes distinctly (header absent, header present but wrong secret, header present with the wrong scheme/no `Bearer` prefix, and `CRON_SECRET` itself unconfigured server-side even with a header sent) plus the success path, and confirms the route actually invokes `notification.runDailyReminderBatch()` (not just that it returns 200) by seeding a real due `ScheduledReminder` on the fake repository beforehand and asserting the returned `{ processed, sent, failedCount }` counts, the reminder's status flips to `"Sent"`, and the tracking `EmailSender` recorded a new send.
- **BR-BOOK-5's guest-lookup generic-error-either-way pattern** — thoroughly verified in `tests/api/public-bookings.test.ts`'s `"POST /api/bookings/lookup — BR-BOOK-5"` block: a nonexistent `bookingReference` and a real-reference-but-wrong-contact both produce the identical 404 status, the identical JSON body (`toEqual`, not just `toMatchObject`), and byte-identical raw response text — an attacker cannot distinguish "no such booking" from "wrong contact for a real booking" from the response alone. A further case confirms a right-reference-wrong-phone-with-omitted-email request produces the same generic error.
- **Cross-module BR-AVAIL-9 wiring** — `tests/api/admin-hours-timeoff.test.ts` verifies both `POST /api/admin/hours` and `POST /api/admin/time-off` not only return `affectedAppointmentIds` in their response but that the route actually called `booking.flagAppointmentsForReview` with them, by reading the appointment's `flaggedForReview` field back off the fake booking repository after the request.
- **BR-BOOK-2b's Completed-only no-show gate** — `tests/api/admin-appointments.test.ts`'s no-show block covers the success path (a past-slotStart appointment, created via `createOverrideBooking` to bypass hours checks, whose effective status has already auto-completed) alongside the 409 rejection of a still-`Booked` (not yet due) appointment, and a 404 for an unknown id.
- **SO-3's override/conflict semantics** — `tests/api/admin-appointments.test.ts` confirms `POST /api/admin/bookings` sets `isOverride: true` when the requested slot falls outside the shop's configured working hours (BR-AVAIL-10), and separately exercises both the `ownerId` and `contact` XOR branches of the request body along with the route's manual validation (empty `pets[]`, both/neither of `ownerId`/`contact` supplied, malformed JSON).

## Verification

```
npx vitest run      # 262 passed, 262 total (18 test files)
npx tsc --noEmit     # zero errors
npx eslint .         # zero errors, zero warnings
```
