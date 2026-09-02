// In-memory fake of AuthRepository (src/modules/auth/repository.ts), for unit testing
// AuthService without a real database.

import { randomUUID } from "node:crypto";
import type { AuthRepository, CreateIdentityInput, CreateSessionInput } from "@/modules/auth/repository";
import type { AuthIdentity, Session } from "@/modules/auth/types";

export interface FakeAuthRepository extends AuthRepository {
  _identities: Map<string, AuthIdentity>;
  _sessions: Map<string, Session>;
}

export function createFakeAuthRepository(): FakeAuthRepository {
  const identities = new Map<string, AuthIdentity>();
  const sessions = new Map<string, Session>();

  return {
    _identities: identities,
    _sessions: sessions,

    async findIdentityByEmail(email) {
      for (const identity of identities.values()) {
        if (identity.email === email) return identity;
      }
      return null;
    },

    async findIdentityById(id) {
      return identities.get(id) ?? null;
    },

    async createIdentity(input: CreateIdentityInput) {
      const identity: AuthIdentity = {
        id: randomUUID(),
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        ownerId: input.ownerId,
        createdAt: new Date(),
        verifiedAt: null,
      };
      identities.set(identity.id, identity);
      return identity;
    },

    async updatePasswordHash(identityId, passwordHash) {
      const existing = identities.get(identityId);
      if (!existing) throw new Error(`fake: no identity ${identityId}`);
      identities.set(identityId, { ...existing, passwordHash });
    },

    async createSession(input: CreateSessionInput) {
      const session: Session = {
        id: randomUUID(),
        authIdentityId: input.authIdentityId,
        role: input.role,
        createdAt: new Date(),
        expiresAt: null,
      };
      sessions.set(session.id, session);
      return session;
    },

    async findSessionByToken(token) {
      return sessions.get(token) ?? null;
    },

    async deleteSession(token) {
      sessions.delete(token); // idempotent — Map.delete on a missing key is a no-op
    },

    async deleteAllSessionsForIdentity(authIdentityId) {
      for (const [token, session] of sessions) {
        if (session.authIdentityId === authIdentityId) {
          sessions.delete(token);
        }
      }
    },
  };
}
