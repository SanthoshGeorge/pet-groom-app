import { defineConfig, defaultExclude } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Code Generation Step 24 adds `@vitejs/plugin-react` so the new `.tsx` component test
  // files (tests/components/**) get a proper React JSX transform. It's a no-op for every
  // pre-existing `.ts` test file (Steps 10/15/18's module/API/repository suites) — Vite only
  // applies a React-specific transform to files it recognizes as JSX-bearing.
  plugins: [react()],
  test: {
    // Default environment stays "node" for the whole suite (unchanged from Steps 1-23) — the
    // new component tests under tests/components/** opt into a DOM environment individually
    // via a `// @vitest-environment jsdom` pragma comment at the top of each file, rather
    // than switching every existing test (262 of them, none touching the DOM) to jsdom
    // globally. jsdom (not happy-dom) was chosen as the more complete/standard DOM
    // implementation, and is what `@testing-library/react`'s own docs default to.
    environment: "node",
    // Registers tests/setup/rtl.ts (jest-dom matchers + automatic post-test unmount) for
    // every test file; the setup file itself no-ops outside a DOM (jsdom) environment, so
    // it's safe to load globally rather than needing a second, component-only Vitest
    // project/config just to scope it.
    setupFiles: ["./tests/setup/rtl.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
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
