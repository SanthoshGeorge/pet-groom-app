// auth module domain types — mirror the `AuthIdentity` and `Session` models in
// prisma/schema.prisma. Pure TypeScript so business logic compiles without the
// (not-yet-generated) Prisma client — see repository.ts for the abstraction boundary.

/** BR-AUTH-5 — exactly two roles. */
export type AuthRole = "customer" | "owner";

/**
 * A login credential. functional-design/domain-entities.md "AuthIdentity".
 *
 * `ownerId` here is a convenience/derived field, not a physical column: prisma/schema.prisma
 * places the actual FK on `Owner.authIdentityId` and expresses this side only as a back-relation
 * (`AuthIdentity.owner`), to avoid two independently-nullable/unique columns drifting out of
 * sync (see that file's comment on the `AuthIdentity` model). The domain type here still
 * exposes `ownerId` because domain-entities.md and BR-AUTH-6 both describe the relationship
 * from this side too — Step 17's repository resolves it via the `owner` relation when mapping
 * a Prisma row to this shape. `role = "owner"` always has `ownerId = null` (BR-AUTH-6).
 */
export interface AuthIdentity {
  id: string;
  email: string;
  passwordHash: string;
  role: AuthRole;
  ownerId: string | null;
  createdAt: Date;
  /** Not used in v1 (BR-AUTH-2 — accounts active immediately); reserved for future email verification. */
  verifiedAt: Date | null;
}

/** `AuthIdentity` minus `passwordHash` — the shape ever handed back to a caller. */
export type PublicAuthIdentity = Omit<AuthIdentity, "passwordHash">;

/**
 * An active logged-in session. functional-design/domain-entities.md "Session".
 * `id` IS the opaque session token referenced from the httpOnly cookie (NFR Design's
 * Session Store: "an opaque token in an httpOnly cookie references a Session row"),
 * not a separate internal id plus a distinct token value.
 */
export interface Session {
  id: string;
  authIdentityId: string;
  /** Denormalized from AuthIdentity for fast role checks. */
  role: AuthRole;
  createdAt: Date;
  /** BR-AUTH-4 — v1 stores no fixed expiry (browser-session-only cookie); reserved for a future "remember me" option. */
  expiresAt: Date | null;
}

export interface ValidatedSession {
  session: Session;
  identity: PublicAuthIdentity;
}
