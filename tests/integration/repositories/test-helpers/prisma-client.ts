// Shared PrismaClient + database-reset helpers for Step 18's real-Postgres repository
// integration tests (tests/integration/repositories/**).
//
// ============================================================================
// READ THIS BEFORE TOUCHING ANYTHING IN tests/integration/repositories/
// ============================================================================
// Every file in this directory imports `@prisma/client` (directly, or transitively via
// the real `src/modules/*/prisma/repository.ts` files it tests) and constructs a real
// `PrismaClient` against a real Postgres database. Both are unavailable in this dev
// container:
//
//   1. `@prisma/client` has no generated types here — `npx prisma generate` cannot
//      succeed in this container. Its internal DMMF-computation bootstrap step needs a
//      native query-engine binary from `binaries.prisma.sh`, which this container's
//      network egress policy blocks — confirmed even with the JS/WASM schema-engine
//      mode already configured in `prisma.config.ts` (that resolves the Schema Engine
//      itself, but not this separate, CLI-internal DMMF-bootstrap blocker, which is
//      independent of the schema's own `engineType`/`previewFeatures` configuration).
//      See `aidlc-docs/audit.md`'s "Investigation — Attempted to resolve the
//      Prisma-binary network block before Phase F" entry, and
//      `aidlc-docs/construction/pet-grooming-booking-platform/code/repository-layer-summary.md`,
//      for the full history.
//   2. Even with generated types, there is no live Postgres instance reachable from
//      this container to point `DATABASE_URL` at.
//
// Consequences, both deliberate — the same pattern `src/modules/*/prisma/repository.ts`
// already established at Step 17:
//   - This file, and every `*.test.ts` file in this directory, is REAL, FINISHED code —
//     written exactly as it would run in a normal, working Prisma project. None of it is
//     a stub or placeholder. It is excluded from `npx vitest run` (`vitest.config.mts`'s
//     `exclude`), `npx tsc --noEmit` (`tsconfig.json`'s `exclude`), and `npx eslint .`
//     (`eslint.config.mjs`'s `globalIgnores`) for exactly the same reason
//     `src/modules/*/prisma/repository.ts` already is — see each config's own comment
//     next to its exclusion entry.
//   - HOW TO ACTUALLY RUN THESE TESTS, once `npx prisma generate` has been run
//     somewhere with real network access (Vercel's build, or a developer's own machine)
//     and `DATABASE_URL` points at a real, DISPOSABLE test Postgres database (Neon for
//     production, any local/test Postgres for local dev — per Infrastructure Design /
//     `deployment-architecture.md`) whose schema has already been migrated onto it
//     (`prisma migrate deploy`, or `prisma db push` for a throwaway schema-only test DB):
//
//       DATABASE_URL="postgresql://...disposable-test-db..." \
//         npx vitest run --config vitest.integration.config.mts
//
//     See `vitest.integration.config.mts`'s own header comment for why a dedicated
//     config file is used instead of folding this directory into `vitest.config.mts`'s
//     normal `include`.
//
// DO NOT point DATABASE_URL at a real production or shared database when running these
// — `resetDatabase` below unconditionally wipes every row in every table these tests
// touch, before EVERY test (see each test file's `beforeEach`).
// ============================================================================

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let sharedClient: PrismaClient | null = null;

/**
 * Returns the process-wide `PrismaClient` for this test run, constructing it (via the
 * same `@prisma/adapter-pg` driver-adapter pattern `prisma.config.ts` already uses for
 * the CLI's own Schema Engine, and the exact pattern `src/modules/*\/prisma/repository.ts`
 * expect their `PrismaClient` argument to come from) on first call.
 */
export function getTestPrismaClient(): PrismaClient {
  if (!sharedClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. tests/integration/repositories/** needs a real, " +
          "disposable test Postgres database — see test-helpers/prisma-client.ts's " +
          "header comment for the full explanation and exact run command.",
      );
    }
    const adapter = new PrismaPg({ connectionString });
    sharedClient = new PrismaClient({ adapter });
  }
  return sharedClient;
}

/**
 * Deletes every row from every table any repository test in this directory touches, in
 * FK-safe (children-before-parents) order, so every test starts from a genuinely empty
 * database — the same fresh-state-per-test isolation Step 10's in-memory fakes already
 * give business-logic tests, just against a real schema instead of a Map. Call this in a
 * `beforeEach`, not `afterEach`, so a failed test's data is still there to inspect.
 *
 * Order (each line must run after every table that has a foreign key INTO it, and before
 * every table it itself has a foreign key OUT to):
 *   ScheduledReminder -> AppointmentLineItem -> Appointment -> TimeOff ->
 *   WorkingHoursRule -> Pet -> Session -> Owner -> AuthIdentity -> Groomer -> Service
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.scheduledReminder.deleteMany(),
    prisma.appointmentLineItem.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.timeOff.deleteMany(),
    prisma.workingHoursRule.deleteMany(),
    prisma.pet.deleteMany(),
    prisma.session.deleteMany(),
    prisma.owner.deleteMany(),
    prisma.authIdentity.deleteMany(),
    prisma.groomer.deleteMany(),
    prisma.service.deleteMany(),
  ]);
}

/**
 * Disconnects and forgets the shared client. Safe to call from every test file's
 * `afterAll` — a later file's `getTestPrismaClient()` call just lazily reconnects.
 */
export async function closeTestPrismaClient(): Promise<void> {
  if (sharedClient) {
    await sharedClient.$disconnect();
    sharedClient = null;
  }
}
