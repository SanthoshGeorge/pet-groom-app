import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Dedicated Vitest config for Code Generation Step 18's real-Postgres repository
// integration tests (tests/integration/repositories/**).
//
// WHY A SEPARATE CONFIG FILE, rather than adding this directory to vitest.config.mts's
// own `include`: these tests import the real Prisma-backed repository files
// (src/modules/*/prisma/repository.ts) and construct a real `PrismaClient` — both
// require `npx prisma generate` to have actually been run and a live `DATABASE_URL` to
// be set, neither of which is true in this dev container (see
// tests/integration/repositories/test-helpers/prisma-client.ts's header comment, and
// aidlc-docs/construction/pet-grooming-booking-platform/code/repository-layer-summary.md,
// for the full history). vitest.config.mts's own `exclude` list keeps this directory out
// of the `npx vitest run` command used everywhere else in this project. Using a wholly
// separate config file — rather than relying on a CLI path argument to override that
// `exclude` — means there is no ambiguity about whether a plain `npx vitest run
// tests/integration/repositories` would actually pick these files up; it explicitly
// won't, and this file is the explicit, unambiguous way to run them instead.
//
// HOW TO RUN, once unblocked (`npx prisma generate` has been run somewhere with real
// network access — Vercel's build, or a developer's own machine — and `DATABASE_URL`
// points at a real, DISPOSABLE test Postgres database with the schema already migrated
// onto it):
//
//   DATABASE_URL="postgresql://...disposable-test-db..." npx vitest run --config vitest.integration.config.mts
//
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/repositories/**/*.{test,spec}.ts"],
    // No global setup/teardown file here on purpose — each test file manages its own
    // PrismaClient lifecycle via test-helpers/prisma-client.ts's
    // getTestPrismaClient/closeTestPrismaClient, the same "no shared global mutable
    // state across files" preference tests/api/test-helpers already established.
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});
