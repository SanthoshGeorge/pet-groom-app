import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma-backed repository implementations (Code Generation Step 17) — these import
    // `@prisma/client`, whose types don't exist until `npx prisma generate` has run
    // somewhere with real network access (blocked in this dev container). See each
    // file's own header comment. Matches the same paths tsconfig.json excludes.
    "src/modules/auth/prisma/**",
    "src/modules/customer/prisma/**",
    "src/modules/catalog/prisma/**",
    "src/modules/availability/prisma/**",
    "src/modules/booking/prisma/**",
    "src/modules/notification/prisma/**",
    "src/modules/reporting/prisma/**",
    // Step 18's real-Postgres repository integration tests — these import
    // `@prisma/client` too (directly, and transitively via the files above), for the
    // same reason. See tests/integration/repositories/test-helpers/prisma-client.ts's
    // header comment. Matches the same path vitest.config.mts's `exclude` and
    // tsconfig.json's `exclude` both use.
    "tests/integration/repositories/**",
  ]),
]);

export default eslintConfig;
