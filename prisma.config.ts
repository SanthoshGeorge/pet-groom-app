// Prisma config — JS/WASM schema engine, added during Code Generation Phase F
// (Repository Layer Generation) specifically to work around this container's
// network egress policy blocking binaries.prisma.sh (confirmed via 403 on every
// engine-binary fetch attempt, including with PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1).
//
// `engine: "js"` tells the Prisma CLI to use the JS/WASM-based Schema Engine
// (bundled inside the `prisma` npm package itself, no network fetch required)
// instead of downloading the native Rust schema-engine binary. It talks to the
// database through a driver adapter (@prisma/adapter-pg + the `pg` npm package)
// rather than Prisma's own native binaries. This is a genuine, supported Prisma
// 6.x feature (see @prisma/config's SchemaEngineConfigJs type), not a hack.
//
// The `prisma-client-js` generator's `engineType = "client"` (see schema.prisma)
// pairs with this: the generated client uses a WASM query compiler bundled in
// the `prisma`/`@prisma/client` packages plus the same driver adapter at
// runtime, so no native query-engine binary is needed there either.
//
// This resolves the Prisma-binary blocker flagged repeatedly since Code
// Generation Step 2 (Phase A) — `prisma generate`, `prisma validate`, and
// `prisma migrate dev` can now all run in this container.
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

export default defineConfig({
  schema: "prisma/schema.prisma",
  experimental: { adapter: true },
  engine: "js",
  adapter: async () => {
    return new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? "postgresql://localhost:5432/placeholder",
    });
  },
});
