// auth module data-access contract — pure interface, no implementation. Business logic
// (service.ts) depends only on this abstraction, never on Prisma directly. A
// Prisma-backed implementation is wired in during Phase F, Step 17.

import type { AuthIdentity, AuthRole, Session } from "./types";

export interface CreateIdentityInput {
  email: string;
  passwordHash: string;
  role: AuthRole;
  /** BR-AUTH-6 — null for `role = "owner"`. */
  ownerId: string | null;
}

export interface CreateSessionInput {
  authIdentityId: string;
  role: AuthRole;
}

export interface AuthRepository {
  findIdentityByEmail(email: string): Promise<AuthIdentity | null>;
  findIdentityById(id: string): Promise<AuthIdentity | null>;
  createIdentity(input: CreateIdentityInput): Promise<AuthIdentity>;
  updatePasswordHash(identityId: string, passwordHash: string): Promise<void>;

  createSession(input: CreateSessionInput): Promise<Session>;
  findSessionByToken(token: string): Promise<Session | null>;
  /** Idempotent — deleting an already-gone/unknown token is not an error. */
  deleteSession(token: string): Promise<void>;
  /** Flow 4, step 3c (BR-AUTH-3) — invalidates every active session for the identity whose password was just reset. */
  deleteAllSessionsForIdentity(authIdentityId: string): Promise<void>;
}
