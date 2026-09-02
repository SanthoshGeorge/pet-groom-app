// AuthService business logic — implements BR-AUTH-1..6 and Flows 2, 3, 4 from
// business-logic-model.md (Flow 1, Identity Resolution, is owned by `customer` — see
// `OwnerIdentityResolver` below for how this module reaches it). Pure TypeScript:
// depends only on the AuthRepository abstraction, no Prisma import.

import { EmailAlreadyUsedError, InvalidCredentialsError, InvalidResetTokenError } from "./errors";
import { hashPassword, verifyPassword } from "./password";
import type { AuthRepository } from "./repository";
import {
  generatePasswordResetToken,
  parseResetTokenIdentityId,
  verifyPasswordResetToken,
} from "./reset-token";
import type { AuthIdentity, PublicAuthIdentity, Session, ValidatedSession } from "./types";
import { normalizeEmail, validateEmail, validatePassword } from "./validation";

/** The contact-info shape `registerAccount` needs to run Flow 1 — structurally identical to `customer`'s own `ContactInfo`. */
export interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

/**
 * The minimal slice of `CustomerService` that `registerAccount` (Flow 2) needs, to
 * orchestrate account creation without `auth` importing the whole `customer` module
 * surface. `createCustomerService(...)`'s return value satisfies this interface
 * structurally — no explicit adapter needed when wiring the two together.
 */
export interface OwnerIdentityResolver {
  /** Flow 2, step 2 (delegates to `customer`'s Flow 1 / BR-CUST-1/2/3). */
  createOrFindOwner(contact: ContactInfo): Promise<{ id: string }>;
  /** Flow 2, step 4 (BR-CUST-4). */
  linkAccount(ownerId: string, authIdentityId: string): Promise<unknown>;
}

export interface AuthServiceDependencies {
  repository: AuthRepository;
  identityResolver: OwnerIdentityResolver;
}

export interface LoginResult {
  session: Session;
  identity: PublicAuthIdentity;
}

export interface RequestPasswordResetResult {
  identity: PublicAuthIdentity;
  /** Hand this to `notification` (Step 8) to email; this method does not send anything itself — see the class-level note below. */
  token: string;
}

export interface AuthService {
  /** Flow 3. */
  login(email: string, password: string): Promise<LoginResult>;
  /** Idempotent — logging out an already-gone session is not an error. */
  logout(token: string): Promise<void>;
  /** Used by other modules to check who's calling (BR-AUTH-4: valid iff the token resolves to a non-expired Session). */
  validateSession(token: string): Promise<ValidatedSession | null>;
  /** Flow 2 — BR-AUTH-1/2/5/6, BR-CUST-4. */
  registerAccount(email: string, password: string, contact: ContactInfo): Promise<LoginResult>;
  /**
   * Flow 4, steps 1-2. Always resolves (never throws for "email not found") — the
   * generic-response guarantee ("respond with the same generic message regardless") is
   * enforced by the caller (the future API route) showing the same message to the user
   * whether this returns `null` or a result; this method itself must still distinguish
   * the two internally; it can't email a token that doesn't exist.
   */
  requestPasswordReset(email: string): Promise<RequestPasswordResetResult | null>;
  /** Flow 4, step 3. */
  resetPassword(token: string, newPassword: string): Promise<void>;
}

/**
 * Factory taking a repository implementation plus the `customer`-shaped collaborator
 * `registerAccount` needs — Step 17 wires in the Prisma-backed `AuthRepository`, and the
 * composition root (wherever these modules get wired together, no later than Step 12)
 * passes the real `CustomerService` instance as `identityResolver`.
 */
export function createAuthService(deps: AuthServiceDependencies): AuthService {
  const { repository, identityResolver } = deps;

  function toPublicIdentity(identity: AuthIdentity): PublicAuthIdentity {
    const { id, email, role, ownerId, createdAt, verifiedAt } = identity;
    return { id, email, role, ownerId, createdAt, verifiedAt };
  }

  return {
    async login(email, password) {
      validateEmail(email);
      if (!password) {
        throw new InvalidCredentialsError();
      }

      // Flow 3, step 1 — do not reveal whether the email exists.
      const identity = await repository.findIdentityByEmail(normalizeEmail(email));
      if (!identity) {
        throw new InvalidCredentialsError();
      }

      // Flow 3, step 2 — same generic error on a password mismatch.
      const passwordMatches = await verifyPassword(password, identity.passwordHash);
      if (!passwordMatches) {
        throw new InvalidCredentialsError();
      }

      // Flow 3, step 3 — BR-AUTH-4: no persistent expiry, browser-session-only cookie.
      const session = await repository.createSession({
        authIdentityId: identity.id,
        role: identity.role,
      });

      return { session, identity: toPublicIdentity(identity) };
    },

    async logout(token) {
      await repository.deleteSession(token);
    },

    async validateSession(token) {
      if (!token) return null;

      const session = await repository.findSessionByToken(token);
      if (!session) return null;

      // BR-AUTH-4 — v1 doesn't set expiresAt, but honor it defensively if a later
      // feature (the "remember me" option the field is reserved for) ever sets one.
      if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
        return null;
      }

      const identity = await repository.findIdentityById(session.authIdentityId);
      if (!identity) return null;

      return { session, identity: toPublicIdentity(identity) };
    },

    async registerAccount(email, password, contact) {
      validateEmail(email);
      validatePassword(password);
      const normalizedEmail = normalizeEmail(email);

      // Flow 2, step 1.
      const existing = await repository.findIdentityByEmail(normalizedEmail);
      if (existing) {
        throw new EmailAlreadyUsedError();
      }

      // Flow 2, step 2 — BR-CUST-1/BR-CUST-4 (delegated to `customer`).
      const owner = await identityResolver.createOrFindOwner(contact);

      // Flow 2, step 3 — BR-AUTH-2 (active immediately, verifiedAt stays null),
      // BR-AUTH-5/6 (public registerAccount never creates role="owner", always links an Owner).
      const passwordHash = await hashPassword(password);
      const identity = await repository.createIdentity({
        email: normalizedEmail,
        passwordHash,
        role: "customer",
        ownerId: owner.id,
      });

      // Flow 2, step 4 — BR-CUST-4.
      await identityResolver.linkAccount(owner.id, identity.id);

      // Flow 2, step 5 — log the user in immediately.
      const session = await repository.createSession({
        authIdentityId: identity.id,
        role: identity.role,
      });

      return { session, identity: toPublicIdentity(identity) };
    },

    async requestPasswordReset(email) {
      if (!email) return null;

      // Flow 4, step 1 — no error either way; only an internal distinction (see the
      // interface doc comment above for why that's still safe).
      const identity = await repository.findIdentityByEmail(normalizeEmail(email));
      if (!identity) return null;

      // Flow 4, step 2.
      const token = generatePasswordResetToken(identity);
      return { identity: toPublicIdentity(identity), token };
    },

    async resetPassword(token, newPassword) {
      validatePassword(newPassword);

      const identityId = parseResetTokenIdentityId(token);
      if (!identityId) {
        throw new InvalidResetTokenError();
      }

      const identity = await repository.findIdentityById(identityId);
      if (!identity) {
        throw new InvalidResetTokenError();
      }

      // Flow 4, step 3a.
      if (!verifyPasswordResetToken(token, identity)) {
        throw new InvalidResetTokenError();
      }

      // Flow 4, step 3b.
      const passwordHash = await hashPassword(newPassword);
      await repository.updatePasswordHash(identity.id, passwordHash);

      // Flow 4, step 3c — BR-AUTH-3.
      await repository.deleteAllSessionsForIdentity(identity.id);

      // Flow 4, step 3d ("mark token used") is satisfied as a side effect of step 3b —
      // see reset-token.ts's header comment for why no separate persisted flag is needed.
    },
  };
}
