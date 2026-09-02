// Password reset tokens — BR-AUTH-3 / Flow 4.
//
// JUDGMENT CALL (documented, not a silent guess — see the Code Generation report):
// no `PasswordResetToken` entity exists anywhere in domain-entities.md or
// prisma/schema.prisma (unlike `ScheduledReminder`, which notification-business-rules.md
// explicitly modeled as a table for the same "something to reference later" need).
// Modifying prisma/schema.prisma is out of this step's scope (it was locked in Step 2).
// So reset tokens here are **stateless and self-verifying**: an HMAC-SHA256 signature
// over `{identityId, expiresAt}`, keyed with the *current* `AuthIdentity.passwordHash`
// in addition to a server secret. This gets every property BR-AUTH-3/Flow 4 asks for
// without a new table:
//   - "time-limited": expiry is embedded in the signed payload and checked on verify.
//   - "single-use": once the token is redeemed, `resetPassword` changes `passwordHash`
//     (Flow 4 step 3b) — because the signature was computed over the OLD passwordHash,
//     that same token (and any other outstanding token for this identity) immediately
//     fails verification if replayed. No "mark token used" write is needed (Flow 4 step
//     3d is satisfied as a side effect of step 3b, not a separate persisted flag).
// Signing secret reuses the already-approved `SESSION_SECRET` env var
// (deployment-architecture.md's Environment Variables table — "Signs/encrypts session
// cookies") rather than inventing a new, undocumented env var for this one flow.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthIdentity } from "./types";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not configured — required to sign password reset tokens",
    );
  }
  return secret;
}

function sign(data: string, passwordHash: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(data)
    .update(passwordHash)
    .digest("base64url");
}

type ResetTokenIdentity = Pick<AuthIdentity, "id" | "passwordHash">;

/** Flow 4, step 2. */
export function generatePasswordResetToken(
  identity: ResetTokenIdentity,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const expiresAt = Date.now() + ttlMs;
  const data = `${identity.id}.${expiresAt}`;
  const signature = sign(data, identity.passwordHash);
  return `${Buffer.from(data, "utf8").toString("base64url")}.${signature}`;
}

/** Reads the identity id out of a token without verifying it, so the caller can look up the identity to verify against. */
export function parseResetTokenIdentityId(token: string): string | null {
  const [dataB64] = token.split(".");
  if (!dataB64) return null;
  try {
    const data = Buffer.from(dataB64, "base64url").toString("utf8");
    const [identityId] = data.split(".");
    return identityId || null;
  } catch {
    return null;
  }
}

/** Flow 4, step 3a. */
export function verifyPasswordResetToken(
  token: string,
  identity: ResetTokenIdentity,
): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [dataB64, signature] = parts;

  let data: string;
  try {
    data = Buffer.from(dataB64, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const [identityId, expiresAtRaw] = data.split(".");
  if (!identityId || identityId !== identity.id) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expectedSignature = sign(data, identity.passwordHash);
  const providedBuf = Buffer.from(signature, "base64url");
  const expectedBuf = Buffer.from(expectedSignature, "base64url");
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}
