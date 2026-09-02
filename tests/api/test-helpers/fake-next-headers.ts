// Test-only in-memory replacement for `next/headers`'s `cookies()`, used by `tests/api/**`
// to integration-test routes that read/write the session cookie (`src/server/session.ts`:
// `getSessionToken`, `getCurrentSession`, `setSessionCookie`, `clearSessionCookie`).
//
// WHY THIS IS NECESSARY (documented deviation, not a silent workaround): this step invokes
// route handlers directly as plain functions (`await POST(request)`), exactly as the Step 15
// task describes, rather than through Next.js's own dev/production server. Next's real
// `cookies()` only works inside the request-scoped async-context Next's server sets up
// around a route handler's execution — calling it from a bare function call throws
// "`cookies` was called outside a request scope" (confirmed empirically against this
// project's Next 16.3.4 before writing this file). That async-context machinery is
// Next-internal and not meant to be driven by application code, so this module replaces
// `next/headers`'s `cookies` export (via `vi.mock`, below — importing this module as a
// test file's FIRST import is what makes the mock take effect before any route module
// transitively imports the real `next/headers`) with a small in-memory cookie jar
// implementing the same minimal shape `session.ts` actually calls (`get`/`set`/`delete`).
//
// Consequence for what "verify a Set-Cookie header was set" means in these tests: because
// the real bridging of `cookies().set(...)` calls onto the HTTP response's actual
// `Set-Cookie` header is also part of that same Next-internal server machinery (routes
// return a separate `NextResponse.json(...)` object; Next's server merges the cookie
// mutations onto it after the handler returns), asserting against a real
// `response.headers.get("set-cookie")` is not meaningful when calling a handler directly.
// Instead, these tests assert against THIS fake jar directly — confirming the route called
// `setSessionCookie`/`clearSessionCookie` with the right cookie name, value, and options
// (httpOnly, sameSite, no maxAge/expires per BR-AUTH-4) — which is the behavior actually
// under this module's own control. The real Set-Cookie wire behavior is Next's own,
// framework-level responsibility, not application code's.
//
// Usage: `import "../test-helpers/fake-next-headers";` as the FIRST import in any
// `tests/api/**` file whose routes (transitively) touch the session cookie, then use
// `resetFakeCookieJar` (in a `beforeEach`), `seedCookie`, and `readFakeCookie` as needed.

import { vi } from "vitest";

export interface StoredCookie {
  value: string;
  options?: Record<string, unknown>;
}

const jar = new Map<string, StoredCookie>();

export function resetFakeCookieJar(): void {
  jar.clear();
}

/** Simulates "the incoming request already carries this cookie" — the equivalent of a
 *  browser attaching a previously-set cookie to its next request. */
export function seedCookie(name: string, value: string): void {
  jar.set(name, { value });
}

export function readFakeCookie(name: string): StoredCookie | undefined {
  return jar.get(name);
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get(name: string) {
      const rec = jar.get(name);
      return rec ? { name, value: rec.value } : undefined;
    },
    set(name: string, value: string, options?: Record<string, unknown>) {
      jar.set(name, { value, options });
    },
    delete(name: string) {
      jar.delete(name);
    },
  }),
}));
