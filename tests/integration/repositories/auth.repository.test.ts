// Step 18 — real-Postgres integration tests for `createPrismaAuthRepository`
// (src/modules/auth/prisma/repository.ts).
//
// ============================================================================
// REQUIRES a generated Prisma Client + a real DATABASE_URL — see
// tests/integration/repositories/test-helpers/prisma-client.ts's header comment for the
// full explanation (this container cannot run `npx prisma generate`) and the exact run
// command. This file is excluded from `npx vitest run` (vitest.config.mts), `npx tsc
// --noEmit` (tsconfig.json), and `npx eslint .` (eslint.config.mjs) for that reason —
// see each config's own comment next to its exclusion entry.
// ============================================================================
//
// SCOPE: Step 10's `tests/modules/auth.test.ts` already covers BR-AUTH-1..6 against a
// fake. This file covers what's NEW at the repository/DB layer: `AuthIdentity.email`'s
// real unique constraint, `createIdentity`'s deliberate "return `ownerId` from the input,
// not a relation read" behavior (see this repository file's own header comment — the
// linking Owner row doesn't exist yet at the instant this method runs), `Session.id`
// doubling as the opaque token (no separate token column), and `deleteSession`'s
// documented idempotency (deleting an unknown token must not throw).

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaAuthRepository } from "@/modules/auth/prisma/repository";
import { closeTestPrismaClient, getTestPrismaClient, resetDatabase } from "./test-helpers/prisma-client";
import { seedOwner } from "./test-helpers/seed";

const prisma = getTestPrismaClient();
const repo = createPrismaAuthRepository(prisma);

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await closeTestPrismaClient();
});

describe("createIdentity / findIdentityByEmail / findIdentityById", () => {
  it("persists and finds an identity by email and by id, with ownerId null for a fresh (unlinked) identity", async () => {
    const created = await repo.createIdentity({
      email: "owner@example.com",
      passwordHash: "hashed-value",
      role: "customer",
      ownerId: null,
    });
    expect(created.role).toBe("customer");
    expect(created.ownerId).toBeNull();
    expect(created.verifiedAt).toBeNull();

    expect((await repo.findIdentityByEmail("owner@example.com"))?.id).toBe(created.id);
    expect((await repo.findIdentityById(created.id))?.id).toBe(created.id);
  });

  it("returns the freshly-linked ownerId directly from the input, since no Owner row points back yet at the moment of this call (see this file's header note)", async () => {
    const owner = await seedOwner(prisma);
    const created = await repo.createIdentity({
      email: "linked@example.com",
      passwordHash: "hashed-value",
      role: "customer",
      ownerId: owner.id,
    });
    expect(created.ownerId).toBe(owner.id);
  });

  it("resolves ownerId via the real Owner.authIdentityId back-relation once an Owner has actually been linked", async () => {
    const created = await repo.createIdentity({
      email: "will-link@example.com",
      passwordHash: "hashed-value",
      role: "customer",
      ownerId: null,
    });
    const owner = await seedOwner(prisma);
    await prisma.owner.update({ where: { id: owner.id }, data: { authIdentityId: created.id } });

    const reread = await repo.findIdentityById(created.id);
    expect(reread?.ownerId).toBe(owner.id);
  });

  it("AuthIdentity.email is unique — creating a second identity with the same email fails", async () => {
    await repo.createIdentity({ email: "dup@example.com", passwordHash: "a", role: "customer", ownerId: null });
    await expect(
      repo.createIdentity({ email: "dup@example.com", passwordHash: "b", role: "owner", ownerId: null }),
    ).rejects.toThrow();
  });

  it("findIdentityByEmail / findIdentityById return null when nothing matches", async () => {
    expect(await repo.findIdentityByEmail("nobody@example.com")).toBeNull();
    expect(await repo.findIdentityById("nonexistent-id")).toBeNull();
  });
});

describe("updatePasswordHash", () => {
  it("BR-AUTH-3 — overwrites passwordHash in place, visible on the next read", async () => {
    const created = await repo.createIdentity({ email: "reset@example.com", passwordHash: "old-hash", role: "customer", ownerId: null });
    await repo.updatePasswordHash(created.id, "new-hash");
    const reread = await repo.findIdentityById(created.id);
    expect(reread?.passwordHash).toBe("new-hash");
  });
});

describe("createSession / findSessionByToken / deleteSession / deleteAllSessionsForIdentity", () => {
  it("Session.id IS the opaque token — no separate token column", async () => {
    const identity = await repo.createIdentity({ email: "session@example.com", passwordHash: "h", role: "owner", ownerId: null });
    const session = await repo.createSession({ authIdentityId: identity.id, role: "owner" });

    const found = await repo.findSessionByToken(session.id);
    expect(found?.id).toBe(session.id);
    expect(found?.authIdentityId).toBe(identity.id);
    expect(found?.role).toBe("owner");
  });

  it("deleteSession is idempotent — deleting an unknown/already-gone token does not throw", async () => {
    await expect(repo.deleteSession("nonexistent-token")).resolves.toBeUndefined();
  });

  it("deleteSession actually removes the row (a subsequent findSessionByToken returns null)", async () => {
    const identity = await repo.createIdentity({ email: "logout@example.com", passwordHash: "h", role: "customer", ownerId: null });
    const session = await repo.createSession({ authIdentityId: identity.id, role: "customer" });
    await repo.deleteSession(session.id);
    expect(await repo.findSessionByToken(session.id)).toBeNull();
  });

  it("BR-AUTH-3 Flow 4 step 3c — deleteAllSessionsForIdentity invalidates every session for that identity, and no others", async () => {
    const identity = await repo.createIdentity({ email: "multi-session@example.com", passwordHash: "h", role: "customer", ownerId: null });
    const otherIdentity = await repo.createIdentity({ email: "unrelated@example.com", passwordHash: "h", role: "customer", ownerId: null });
    const s1 = await repo.createSession({ authIdentityId: identity.id, role: "customer" });
    const s2 = await repo.createSession({ authIdentityId: identity.id, role: "customer" });
    const otherSession = await repo.createSession({ authIdentityId: otherIdentity.id, role: "customer" });

    await repo.deleteAllSessionsForIdentity(identity.id);

    expect(await repo.findSessionByToken(s1.id)).toBeNull();
    expect(await repo.findSessionByToken(s2.id)).toBeNull();
    expect(await repo.findSessionByToken(otherSession.id)).not.toBeNull();
  });
});
