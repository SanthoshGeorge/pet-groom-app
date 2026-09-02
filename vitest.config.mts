import { defineConfig, defaultExclude } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts", "src/**/*.{test,spec}.ts"],
    // Code Generation Step 18's real-Postgres repository integration tests
    // (tests/integration/repositories/**) are EXCLUDED from this default config on
    // purpose — they import the real Prisma-backed repository files
    // (src/modules/*/prisma/repository.ts) and construct a real PrismaClient, both of
    // which require `npx prisma generate` to have actually run and a live
    // DATABASE_URL to be set, neither available in this dev container (see
    // tests/integration/repositories/test-helpers/prisma-client.ts's header comment
    // and code/repository-layer-summary.md for the full history). Running `npx vitest
    // run` here must keep passing without a database — that suite has its own
    // dedicated config, vitest.integration.config.mts (see its header comment for
    // exactly how/why), for use once `prisma generate` has run somewhere with real
    // network access and DATABASE_URL points at a real, disposable test database.
    exclude: [...defaultExclude, "tests/integration/repositories/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});
