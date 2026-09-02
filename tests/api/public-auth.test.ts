// Integration tests for the 5 public auth routes (Code Generation Step 15):
// POST /api/auth/register, /login, /logout, /forgot-password, /reset-password.
//
// Uses the fake `next/headers` cookie jar (tests/api/test-helpers/fake-next-headers.ts —
// see its header comment for why this is necessary and what "verify Set-Cookie" means once
// route handlers are invoked directly rather than through Next's own server) since every
// one of these routes reads or writes the "session" cookie via src/server/session.ts.

import "./test-helpers/fake-next-headers";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { POST as forgotPasswordPost } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordPost } from "@/app/api/auth/reset-password/route";
import { SESSION_COOKIE_NAME } from "@/server/session";
import { __resetServicesForTesting, __setServicesForTesting } from "@/server/container";
import { buildTestServices, type TestServicesBundle } from "./test-helpers/build-test-services";
import { jsonRequest, malformedJsonRequest } from "./test-helpers/request";
import { readFakeCookie, resetFakeCookieJar, seedCookie } from "./test-helpers/fake-next-headers";

const REGISTER_URL = "http://localhost/api/auth/register";
const LOGIN_URL = "http://localhost/api/auth/login";
const FORGOT_URL = "http://localhost/api/auth/forgot-password";
const RESET_URL = "http://localhost/api/auth/reset-password";

beforeAll(() => {
  // auth's reset-token.ts requires SESSION_SECRET to sign/verify password reset tokens —
  // same env var tests/modules/auth.test.ts sets for the same reason.
  process.env.SESSION_SECRET ??= "test-session-secret-not-for-production";
});

describe("public auth routes", () => {
  let bundle: TestServicesBundle;

  beforeEach(async () => {
    bundle = await buildTestServices();
    __setServicesForTesting(bundle.services);
    resetFakeCookieJar();
  });

  afterEach(() => {
    __resetServicesForTesting();
  });

  describe("POST /api/auth/register", () => {
    it("201s with { identity } (no passwordHash) and sets the session cookie — BR-AUTH-1/2/4", async () => {
      const res = await registerPost(
        jsonRequest(REGISTER_URL, "POST", {
          email: "jane@example.com",
          password: "password123",
          name: "Jane Doe",
          phone: "555-0100",
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.identity).toMatchObject({ email: "jane@example.com", role: "customer" });
      expect(body.identity.passwordHash).toBeUndefined();
      expect(body.identity.ownerId).toBeTruthy();

      const cookie = readFakeCookie(SESSION_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBeTruthy();
      // BR-AUTH-4 — httpOnly, browser-session-only (no maxAge/expires).
      expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
      expect(cookie?.options).not.toHaveProperty("maxAge");
      expect(cookie?.options).not.toHaveProperty("expires");
    });

    it("400s when a required field is missing", async () => {
      const res = await registerPost(jsonRequest(REGISTER_URL, "POST", { email: "jane@example.com", password: "password123" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });

    it("400s on malformed JSON body", async () => {
      const res = await registerPost(malformedJsonRequest(REGISTER_URL, "POST"));
      expect(res.status).toBe(400);
    });

    it("409s when the email is already registered", async () => {
      await registerPost(
        jsonRequest(REGISTER_URL, "POST", { email: "jane@example.com", password: "password123", name: "Jane Doe", phone: "555-0100" }),
      );
      resetFakeCookieJar();
      const res = await registerPost(
        jsonRequest(REGISTER_URL, "POST", { email: "jane@example.com", password: "different456", name: "Jane Two", phone: "555-0199" }),
      );
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/auth/login", () => {
    it("200s with { identity } and sets the session cookie on correct credentials", async () => {
      await registerPost(
        jsonRequest(REGISTER_URL, "POST", { email: "jane@example.com", password: "password123", name: "Jane Doe", phone: "555-0100" }),
      );
      resetFakeCookieJar();

      const res = await loginPost(jsonRequest(LOGIN_URL, "POST", { email: "jane@example.com", password: "password123" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.identity.email).toBe("jane@example.com");
      expect(readFakeCookie(SESSION_COOKIE_NAME)?.value).toBeTruthy();
    });

    it("401s with the same generic message for an unknown email and for a wrong password on a known email (no account-existence leak)", async () => {
      await registerPost(
        jsonRequest(REGISTER_URL, "POST", { email: "jane@example.com", password: "password123", name: "Jane Doe", phone: "555-0100" }),
      );
      resetFakeCookieJar();

      const unknownEmailRes = await loginPost(jsonRequest(LOGIN_URL, "POST", { email: "nobody@example.com", password: "whatever123" }));
      const wrongPasswordRes = await loginPost(jsonRequest(LOGIN_URL, "POST", { email: "jane@example.com", password: "wrong-password" }));

      expect(unknownEmailRes.status).toBe(401);
      expect(wrongPasswordRes.status).toBe(401);
      const [unknownBody, wrongBody] = await Promise.all([unknownEmailRes.json(), wrongPasswordRes.json()]);
      expect(unknownBody).toEqual(wrongBody);
      // Neither failed attempt should have set a session cookie.
      expect(readFakeCookie(SESSION_COOKIE_NAME)).toBeUndefined();
    });

    it("400s when email or password is missing", async () => {
      const res = await loginPost(jsonRequest(LOGIN_URL, "POST", { email: "jane@example.com" }));
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("200s and clears the session cookie when one was present", async () => {
      await registerPost(
        jsonRequest(REGISTER_URL, "POST", { email: "jane@example.com", password: "password123", name: "Jane Doe", phone: "555-0100" }),
      );
      expect(readFakeCookie(SESSION_COOKIE_NAME)).toBeDefined();

      const res = await logoutPost();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });
      expect(readFakeCookie(SESSION_COOKIE_NAME)).toBeUndefined();
    });

    it("200s idempotently even with no session cookie present at all", async () => {
      resetFakeCookieJar();
      const res = await logoutPost();
      expect(res.status).toBe(200);
      expect(readFakeCookie(SESSION_COOKIE_NAME)).toBeUndefined();
    });

    it("200s idempotently for a stale/unknown session token", async () => {
      seedCookie(SESSION_COOKIE_NAME, "token-that-was-never-issued");
      const res = await logoutPost();
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("200s with the identical generic message for a known email and an unknown one — BR-AUTH-3 (never reveals whether an account exists)", async () => {
      await registerPost(
        jsonRequest(REGISTER_URL, "POST", { email: "jane@example.com", password: "password123", name: "Jane Doe", phone: "555-0100" }),
      );
      resetFakeCookieJar();

      const knownRes = await forgotPasswordPost(jsonRequest(FORGOT_URL, "POST", { email: "jane@example.com" }));
      const unknownRes = await forgotPasswordPost(jsonRequest(FORGOT_URL, "POST", { email: "nobody@example.com" }));

      expect(knownRes.status).toBe(200);
      expect(unknownRes.status).toBe(200);
      const [knownBody, unknownBody] = await Promise.all([knownRes.json(), unknownRes.json()]);
      expect(knownBody).toEqual(unknownBody);
      // Never echoes a reset token back in the HTTP response.
      expect(JSON.stringify(knownBody)).not.toMatch(/token/i);
    });

    it("400s when email is missing", async () => {
      const res = await forgotPasswordPost(jsonRequest(FORGOT_URL, "POST", {}));
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("200s and actually changes the password (real reset-token flow, not just the HTTP shape)", async () => {
      await registerPost(
        jsonRequest(REGISTER_URL, "POST", { email: "jane@example.com", password: "password123", name: "Jane Doe", phone: "555-0100" }),
      );
      resetFakeCookieJar();

      // Obtain a real token via the underlying service (the route's response deliberately
      // never echoes it — see forgot-password's own test above).
      const resetResult = await bundle.auth.requestPasswordReset("jane@example.com");
      expect(resetResult?.token).toBeTruthy();

      const res = await resetPasswordPost(jsonRequest(RESET_URL, "POST", { token: resetResult!.token, newPassword: "new-password-456" }));
      expect(res.status).toBe(200);
      // Does NOT log the caller in — no session cookie set by this route.
      expect(readFakeCookie(SESSION_COOKIE_NAME)).toBeUndefined();

      // New password now works; old one doesn't.
      const loginOld = await loginPost(jsonRequest(LOGIN_URL, "POST", { email: "jane@example.com", password: "password123" }));
      expect(loginOld.status).toBe(401);
      resetFakeCookieJar();
      const loginNew = await loginPost(jsonRequest(LOGIN_URL, "POST", { email: "jane@example.com", password: "new-password-456" }));
      expect(loginNew.status).toBe(200);
    });

    it("400s for a malformed/unknown reset token", async () => {
      const res = await resetPasswordPost(jsonRequest(RESET_URL, "POST", { token: "not-a-real-token", newPassword: "new-password-456" }));
      expect(res.status).toBe(400);
    });

    it("400s when token or newPassword is missing", async () => {
      const res = await resetPasswordPost(jsonRequest(RESET_URL, "POST", { token: "sometoken" }));
      expect(res.status).toBe(400);
    });
  });
});
