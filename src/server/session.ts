// Session-cookie plumbing shared by every route that needs to know "who is calling" —
// `auth/login` and `auth/register` (set the cookie), `auth/logout` (clear it), and
// `account/pets` plus `bookings`/`bookings/[id]` (read it to resolve the caller's identity).
//
// Cookie name: "session" (SESSION_COOKIE_NAME below) — deliberately plain, not e.g.
// "petgroom_session"; this is a single-app, single-cookie-namespace site (nothing else on
// this domain could collide), and neither tech-stack-decisions.md nor any Functional Design
// artifact names one, so this is a Step 12 judgment call, documented here rather than
// picked silently.
//
// Cookie attributes (`setSessionCookie` below): `httpOnly` (never readable from
// client-side JS — BR-AUTH-4/tech-stack-decisions.md's "Authentication" section),
// `secure` in production (not in local dev over plain HTTP), `sameSite: "lax"` (standard
// CSRF-mitigating default for a same-site form-post-heavy app with no cross-site embedding
// need). Deliberately NO `maxAge`/`expires` — BR-AUTH-4 requires a browser-session-only
// cookie ("a session ends when the browser is closed"), which is exactly what omitting both
// of those options produces (the browser drops the cookie itself; nothing server-side needs
// to enforce an expiry).
//
// `Session.id` (`src/modules/auth/types.ts`) IS the opaque token this cookie's value holds
// — there's no separate "session id vs. token" distinction to track here (see that type's
// own doc comment).

import { cookies } from "next/headers";
import { getServices } from "./container";
import type { ValidatedSession } from "@/modules/auth";
import { HttpError } from "./http";

export const SESSION_COOKIE_NAME = "session";

/** The raw cookie value, unvalidated — use `getCurrentSession` when you need it resolved
 * against a real `AuthIdentity`/`Session` pair; this is for the rarer case (`auth/logout`)
 * that needs the bare token itself. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/** Resolves the current request's session cookie into a `ValidatedSession`, or `null` if
 * there's no cookie, the token is unknown, or the session has expired (BR-AUTH-4) — never
 * throws for "not logged in", so every caller can treat `null` as "anonymous." */
export async function getCurrentSession(): Promise<ValidatedSession | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return getServices().auth.validateSession(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // No maxAge/expires — BR-AUTH-4: browser-session-only.
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/**
 * Shared owner-only gate for every admin route (Code Generation Step 13) — "all gated by
 * `auth.validateSession`, `role=owner`" per every Functional Design pass's stated rule
 * (e.g. `booking-business-logic-model.md`'s Flow 2/6/7 notes, `availability-business-logic-
 * model.md`'s Flow 5/6). Every `src/app/api/admin/**` route calls this first, inside its
 * own `try { ... } catch (err) { return errorToResponse(err); }` block, so a missing/invalid
 * session and a non-owner session both come back as the standard JSON error shape rather
 * than each route hand-rolling its own 401/403 check.
 *
 * Two distinct failure statuses, not one — same distinction `HttpError`'s callers already
 * make elsewhere: 401 when there's no proof of who's calling at all, 403 when there is one
 * but it doesn't carry the required role (a real, authenticated `role=customer` caller
 * hitting an admin route is not "unauthenticated," so it must not read as one).
 */
export async function requireOwnerSession(): Promise<ValidatedSession> {
  const session = await getCurrentSession();
  if (!session) {
    throw new HttpError(401, "Log in as the shop owner to access this resource");
  }
  if (session.identity.role !== "owner") {
    throw new HttpError(403, "Only the shop owner can access this resource");
  }
  return session;
}
