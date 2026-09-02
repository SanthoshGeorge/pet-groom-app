# Repository Layer Summary

**Unit**: Pet Grooming Booking Platform
**Scope**: Code Generation Phase F (Repository Layer Generation, Step 17) and Phase G (Repository Layer Testing, Step 18), summarized here per Step 19.

---

## The Prisma-generation blocker — exact current state (read this first)

Every claim below about "what was generated" is real, finished, hand-verified code. None of it has ever been compiled, type-checked, or executed, because `@prisma/client` has no generated types anywhere in this codebase. This has been true since Step 2 (Phase A) and remains true today:

- **What's blocked, precisely**: `npx prisma generate` (and `validate`/`format`/`migrate dev`) fail because their shared internal DMMF-computation bootstrap step unconditionally attempts to download a native `libquery-engine` binary from `binaries.prisma.sh`, before any generator (including `prisma-client-js`) ever runs. This container's network egress policy blocks that host (confirmed via direct 403/`connect_rejected` responses on the proxy status endpoint).
- **What is NOT blocked, and was already fixed at Step 17's start**: Prisma 6.19's newer JS/WASM Schema Engine mode (`engine: "js"` in `prisma.config.ts`, `@prisma/adapter-pg` + `pg` driver adapters, `engineType = "client"` in `schema.prisma`'s generator block) genuinely works with zero network calls — confirmed via `DEBUG=prisma:*` tracing ("Using getConfig Wasm... config data retrieved without errors"). This is real, useful, already-committed progress, and is independently good practice for Neon (driver adapters are Prisma's own recommended pattern for serverless Postgres). It does **not**, however, unblock the DMMF-bootstrap step above — that is separate, CLI-internal plumbing not yet migrated to WASM in this Prisma version, confirmed to be a genuine version/feature-maturity limit (the `engine: "js"` schema-engine feature is explicitly documented as "unstable"), not a misconfiguration on this project's part.
- **Consequence**: `@prisma/client`'s type declarations do not exist on disk. Every file that imports from `@prisma/client` — the 7 files this document is about, plus every new file Step 18 added — cannot be parsed by `tsc`, linted by `eslint`, bundled by `next build`, or executed by `vitest` in this container. Not "runs but fails" — cannot even be loaded.
- **What specifically needs to happen, and by whom, before this layer is live**:
  1. Run `npx prisma generate` somewhere with real network access — Vercel's build step (the normal path; nothing extra to configure, this is a standard `postinstall`/build-time step), or a developer's own machine with unrestricted internet access. This produces the generated `@prisma/client` types.
  2. Point a real `DATABASE_URL` at an actual Postgres instance — Neon for production (per `tech-stack-decisions.md`/Infrastructure Design), any local or test Postgres for local development — and run the not-yet-executed Step 26 (`prisma migrate dev`) against it to create the schema.
  3. In `src/server/container.ts`, swap each `createPlaceholderRepository<XRepository>("X")` call for the matching real `createPrismaXRepository(prisma)` call from this phase's output (a single, mechanical `PrismaClient` instance, constructed via the same `@prisma/adapter-pg` pattern `prisma.config.ts` already uses, passed to all 7 factories). **Nothing else changes** — every route handler already calls `getServices()` against the same `Services` interface either way (see `container.ts`'s own header comment, and `api-layer-summary.md`'s "composition-root / placeholder-repository" section).
  4. Run Step 18's integration test suite (below) against that same disposable database to confirm the real repositories behave as written, before removing the placeholder wiring from anything that matters.
- **Everything above this layer is unaffected and fully working today.** All 7 modules' business logic (Steps 3-9, `src/modules/*/service.ts`), their 156 Step 10 unit tests, all 21 API routes (Steps 12-14), and their 106 Step 15 integration tests — 262 tests total — run and pass right now, against Step 10's in-memory fake repositories (`tests/fakes/*.fake.ts`), with zero dependency on Prisma. `npx tsc --noEmit`, `npx eslint .`, and `npx next build` are all clean. Nothing in this document changes that; the fakes and the real Prisma repositories are two independent implementations of the same `*Repository` interfaces, and swapping which one `container.ts` wires up is the only thing that changes when Prisma is eventually unblocked.

This is the same deviation pattern Step 15 used for "integration tests against a test database" (see `api-layer-summary.md`'s "test-database deviation" section) and Step 17 used for the repositories themselves (see `aidlc-docs/audit.md`'s "Investigation — Attempted to resolve the Prisma-binary network block before Phase F" and the Step 17 completion entry) — applied here one layer further up the stack, for the same underlying reason.

## What Step 17 generated

All 7 modules' Prisma-backed repositories, under `src/modules/*/prisma/repository.ts`:

| Module | File | Lines | Notes |
|---|---|---|---|
| `auth` | `src/modules/auth/prisma/repository.ts` | 167 | `AuthIdentity.ownerId` resolved via the `owner` back-relation on reads; `createIdentity` returns `ownerId` from its input, not a relation read (the linking `Owner` row doesn't exist yet at that instant — see the file's own note). |
| `customer` | `src/modules/customer/prisma/repository.ts` | 183 | 1:1 field mapping for `Owner`/`Pet`; `findOwnerByEmail`/`findOwnerByPhone` use `findFirst` (neither column is unique in the schema). |
| `catalog` | `src/modules/catalog/prisma/repository.ts` | 110 | `Service.price`'s `Decimal` <-> `number` conversion at the read/write boundary. |
| `availability` | `src/modules/availability/prisma/repository.ts` | 311 | `@db.Time` <-> `"HH:mm"` and `@db.Date` conversions; see the BR-AVAIL-5 architectural note below. |
| `booking` | `src/modules/booking/prisma/repository.ts` | 352 | Where BR-AVAIL-5's real atomicity guarantee actually lives (see below); price/duration snapshot write; `P2002` translation. |
| `notification` | `src/modules/notification/prisma/repository.ts` | 165 | `findDueReminders`'s nested `include` pairing a reminder with its full appointment; writes the `booking`-owned `notificationFailed` flag. |
| `reporting` | `src/modules/reporting/prisma/repository.ts` | 69 | Owns no table; two `Promise.all`-parallel `count` aggregates against `Appointment`. |

**Total: 1,357 lines across the 7 files.** Every file carries the same header comment (excluded-from-tooling notice, exactly why, and confirmation it is finished code, not a stub) and is excluded from `tsconfig.json`, `eslint.config.mjs`, and — as of Step 15 already — never wired into `src/server/container.ts`'s default (placeholder-backed) path.

### The BR-AVAIL-5 architectural resolution (the single most important finding from this phase)

`nfr-design-patterns.md`'s "Slot-claim concurrency" pattern describes the atomic guarantee as: attempt the `Appointment` insert directly inside a transaction, catch a real Postgres unique-constraint violation, translate it to "slot no longer available." Having read `prisma/schema.prisma`, `availability/repository.ts`'s `ClaimSlotInput` shape, and `booking/service.ts`'s actual call order, that literal design turned out not to be achievable inside `availability.claimSlot` itself:

- There is no `SlotClaim` table — `prisma/schema.prisma`'s own header comment confirms this is intentional (`Slot`/`SlotClaim` are computed/conceptual). The only table carrying the `(groomerId, slotStart)` uniqueness constraint is `Appointment` (`@@unique([groomerId, slotStart])`).
- `ClaimSlotInput` is exactly `{ appointmentId, start, end }` — no `ownerId`, `bookingReference`, `createdBy`, or line items. `availability` has no way to construct an insertable `Appointment` row.
- `booking/service.ts` calls `availability.claimSlot`/`forceClaimSlot` *before* `repository.createAppointment` assembles and inserts the actual row (with the same, client-pre-generated id) — so no valid row exists yet at the moment `claimSlot` runs, for `availability` to attempt inserting on `booking`'s behalf.

**Resolution, implemented exactly as described in both files' own architectural notes**: the real, DB-enforced insert-and-catch-`P2002` guarantee lives in `booking/prisma/repository.ts`'s `createAppointment` — the one place in the system where a complete, insertable `Appointment` row actually exists. That method wraps the `Appointment` insert and its `AppointmentLineItem` inserts in one `prisma.$transaction`; the loser of a real concurrent race gets a `PrismaClientKnownRequestError` with `code === "P2002"`, which `translateCreateAppointmentError` inspects (`err.meta.target`) to distinguish two genuinely different constraints on the same table:

- `(groomerId, slotStart)` — BR-AVAIL-5's real guarantee — translated to `SlotNotAvailableError` (`booking/errors.ts`), the exact class `booking/service.ts` already expects.
- `Appointment.bookingReference`'s own, unrelated unique constraint (BR-BOOK-8) — translated to `BookingReferenceCollisionError`, which `service.ts`'s `persistAppointment` already catches and retries with a freshly generated reference.

`availability/prisma/repository.ts`'s own `claimSlot`/`forceClaimSlot` remain faithful to their documented contract given this: `claimSlot` does a best-effort, late re-check read against the live `Appointment` table (any status — the real unique index doesn't exempt Cancelled/NoShow rows either) and throws `SlotConstraintViolationError` on a hit; `forceClaimSlot` is an intentional no-op, mirroring `AvailabilityService.releaseSlot`'s already-established precedent. Neither weakens BR-AVAIL-5 — the guarantee is relocated to the one place a valid row exists to trigger it, and both files' header comments flag this prominently for anyone touching either repository later.

## What Step 18's tests cover, and how they're structured

Since Step 17's code has never run, Step 18 could not literally do what the plan's own wording says ("integration tests against a real (test) Postgres instance... against the real database, not just a mocked one") *in this container* — there is no way to execute any Prisma-backed code here at all, real or mocked. The adaptation mirrors Step 15's and Step 17's own precedent: **write the real, finished, meant-to-actually-run test suite now, exclude it from every tool this container runs, and leave it ready to execute the moment Step 17's blocker clears.**

### Layout

```
tests/integration/repositories/
  test-helpers/
    prisma-client.ts   — shared PrismaClient (via @prisma/adapter-pg) + resetDatabase() + closeTestPrismaClient()
    seed.ts            — fixture helpers (seedGroomer/seedOwner/seedPet/seedService/seedAppointment), calling
                          prisma.<model>.create directly — never through a repository under test
  auth.repository.test.ts
  customer.repository.test.ts
  catalog.repository.test.ts
  availability.repository.test.ts
  booking.repository.test.ts       <- the BR-AVAIL-5 concurrent-request test lives here
  notification.repository.test.ts
  reporting.repository.test.ts
```

Every test file's own header comment repeats the blocker explanation and the exact run command, so it's legible standing alone. `resetDatabase()` deletes every row across all 11 tables in FK-safe (children-before-parents) order in a `beforeEach`, giving each test the same fresh-state isolation Step 10's in-memory fakes already give business-logic tests — just against a real schema instead of a `Map`.

A dedicated `vitest.integration.config.mts` runs this directory (`include: ["tests/integration/repositories/**/*.{test,spec}.ts"]`); `vitest.config.mts` (the default, used by `npx vitest run` / `npm test` everywhere else in this project) explicitly `exclude`s the same directory. Two separate config files, rather than one config with the directory excluded and a CLI path argument to override that for a manual run, so there's no ambiguity about which files a given command actually picks up. Once unblocked:

```
DATABASE_URL="postgresql://...disposable-test-db..." npx vitest run --config vitest.integration.config.mts
```

(after `prisma generate` has produced real types, and `prisma migrate deploy`/`db push` has created the schema on that `DATABASE_URL`).

### The BR-AVAIL-5 concurrent-request test — exact mechanics

`tests/integration/repositories/booking.repository.test.ts`, describe block `"BR-AVAIL-5 — Slot claims must be atomic, enforced by the REAL database constraint"`:

1. Seeds one `Groomer` and `Owner`/`Pet`/`Service` fixtures (via `test-helpers/seed.ts`, direct `prisma.*.create` calls — not through the repository under test).
2. Builds **12** distinct `CreateAppointmentInput` objects, each with its own pre-generated `id` (`randomUUID()`) and its own unique `bookingReference` (`HTG-1000`..`HTG-1011`), but **the identical `(groomerId, slotStart)`** — this isolates the slot race from BR-BOOK-8's own, separately-tested `bookingReference` collision path.
3. Fires all 12 through `createPrismaBookingRepository(prisma).createAppointment(...)` **simultaneously** via `Promise.allSettled` — the method Step 17's own architectural note identifies as where the real guarantee lives, per the task's explicit instruction to target `booking`'s repository-level appointment-creation method, not `availability.claimSlot`.
4. Asserts exactly 1 of the 12 settles `fulfilled` and the other 11 settle `rejected`, each rejection's reason `instanceof SlotNotAvailableError` — the class `translateCreateAppointmentError` produces from a real caught `P2002` on the `(groomerId, slotStart)` constraint.
5. Independently re-queries `prisma.appointment.findMany({ where: { groomerId, slotStart } })` and asserts exactly one row exists — proving the guarantee at the database level itself, not just "one promise happened to resolve."

A second test in the same block seeds a *second* `Groomer` and confirms two concurrent `createAppointment` calls for the **same `slotStart` but different groomers** both succeed — confirming the constraint's exact scope (per-groomer, not slotStart alone) rather than just asserting the happy path once. A third describe block separately proves the *other* `P2002` branch: reusing a `bookingReference` for a genuinely different `(groomerId, slotStart)` yields `BookingReferenceCollisionError`, not `SlotNotAvailableError` — confirming `translateCreateAppointmentError`'s two-constraint disambiguation logic, the one piece of nontrivial conditional logic in the whole repository layer.

`availability.repository.test.ts` deliberately does **not** re-run this concurrency test against `claimSlot` — its own header comment explains why (that method is a best-effort pre-check, not the guarantee), and instead verifies `claimSlot`/`forceClaimSlot` are faithful to their own documented, non-atomic contract (conflict detection, self-exclusion, the no-active-groomer edge case, `forceClaimSlot`'s no-op).

### Coverage by module (proportional to complexity, per the task's instruction)

| File | Tests | What's new here vs. Step 10's fake-backed coverage |
|---|---|---|
| `booking.repository.test.ts` | 17 | BR-AVAIL-5's real concurrent-request guarantee (2 tests) + BR-BOOK-8's collision-vs-slot-collision disambiguation (1) + the price/duration snapshot's real atomicity (2) + full CRUD (`updateStatus`'s `undefined`-means-unchanged semantics, `updateSlot`, `updateVisitNotes`, `listByOwner`/`listByDateRange` ordering and half-open boundaries, `setFlaggedForReview`, `findDefaultGroomer`) |
| `availability.repository.test.ts` | 14 | `@db.Time`/`@db.Date` real column round-trips, `replaceWorkingHours`'s upsert-not-duplicate behavior, `listOccupiedRanges`/`listFutureOccupiedRanges`'s real status/half-open-overlap filtering, `claimSlot`'s non-atomic contract in full (including the Cancelled-still-conflicts and self-exclusion cases), `forceClaimSlot`'s no-op |
| `auth.repository.test.ts` | 10 | `AuthIdentity.email`'s real unique constraint; `createIdentity`'s ownerId-from-input-not-relation quirk, both at creation and once actually linked; `deleteSession`'s real idempotency |
| `customer.repository.test.ts` | 7 | `findOwnerByEmail`/`findOwnerByPhone`'s `findFirst`-against-non-unique-columns behavior (a fake never had to model two rows sharing an email); `updateOwner`/`updatePet` partial-update semantics |
| `catalog.repository.test.ts` | 5 | `Decimal` <-> `number` round-trip; `updateService`'s real partial-update semantics — the exact gap `api-layer-summary.md` flagged as unverified pending this phase |
| `notification.repository.test.ts` | 5 | `findDueReminders`'s nested `include` producing a correctly-shaped `DueReminder` from real relations in one round trip; `markAppointmentNotificationFailed`'s cross-module write, idempotently |
| `reporting.repository.test.ts` | 3 | Both `count` aggregates as real, independent Postgres queries, scoped correctly to the half-open range and to `status = NoShow` |
| **Total** | **61** | across 7 files, plus 2 shared `test-helpers/` files |

## Manual review (the substitute for automated verification)

No tool in this container can typecheck, lint, or execute any file listed above. Every file was instead checked by hand against `prisma/schema.prisma` (field names, types, nullability, enum members, unique constraints) and the corresponding `src/modules/*/repository.ts` interface / `src/modules/*/prisma/repository.ts` implementation it exercises — confirming input shapes match each interface's types exactly (e.g. `CreateAppointmentInput`'s literal `status: "Booked"`, `UpdateStatusInput`'s optional `cancelledAt`/`cancelledBy`), that seeded fixtures satisfy every required, non-defaulted column, and that each assertion's expected value follows from the repository implementation actually being tested (not from an assumption about what it "should" do).

## Verification (this container, unaffected by anything above)

```
npx vitest run       # 262 passed, 262 total (18 test files) — unchanged; the 7 new
                      # integration test files + 2 test-helpers are excluded via
                      # vitest.config.mts's `exclude` and never collected
npx tsc --noEmit      # zero errors — tsconfig.json's `exclude` covers the same new files
npx eslint .          # zero errors, zero warnings — eslint.config.mjs's globalIgnores covers them
npx next build        # succeeds, all 21 routes registered, unaffected
```
