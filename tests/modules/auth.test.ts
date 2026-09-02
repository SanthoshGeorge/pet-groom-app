// Unit tests for AuthService (src/modules/auth) — Code Generation Step 10.
// Covers every numbered rule in business-rules.md's "Auth (AuthService)" section
// (BR-AUTH-1..6) plus Flows 2, 3, 4 from business-logic-model.md. Backed by an in-memory
// fake AuthRepository (tests/fakes/auth.fake.ts). `registerAccount`'s `identityResolver`
// dependency is the REAL `createCustomerService` wired to a fake CustomerRepository
// (tests/fakes/customer.fake.ts) — `CustomerService` satisfies `OwnerIdentityResolver`
// structurally (see service.ts's doc comment), which is exactly how the real composition
// root wires these two modules together, so this exercises the actual Flow 2 handoff
// rather than a stand-in mock.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAuthService, type AuthService } from "@/modules/auth/service";
import {
  AuthValidationError,
  EmailAlreadyUsedError,
  InvalidCredentialsError,
  InvalidResetTokenError,
} from "@/modules/auth/errors";
import { hashPassword } from "@/modules/auth/password";
import { createCustomerService } from "@/modules/customer/service";
import { createFakeAuthRepository, type FakeAuthRepository } from "../fakes/auth.fake";
import { createFakeCustomerRepository } from "../fakes/customer.fake";

beforeAll(() => {
  // reset-token.ts requires SESSION_SECRET to sign/verify password reset tokens.
  process.env.SESSION_SECRET ??= "test-session-secret-not-for-production";
});

describe("AuthService", () => {
  let repository: FakeAuthRepository;
  let service: AuthService;
  const contact = { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" };

  beforeEach(() => {
    repository = createFakeAuthRepository();
    const customerRepository = createFakeCustomerRepository();
    service = createAuthService({ repository, identityResolver: createCustomerService(customerRepository) });
  });

  describe("BR-AUTH-1 — Account creation is optional, always", () => {
    it("validateSession treats a missing/empty token as simply 'no session', never an error", async () => {
      // No AuthIdentity or Session exists anywhere in the fake repository at all — the
      // module must not require one to exist to answer this query correctly.
      await expect(service.validateSession("")).resolves.toBeNull();
      await expect(service.validateSession("some-unknown-token")).resolves.toBeNull();
    });
  });

  describe("BR-AUTH-2 — Accounts are active immediately", () => {
    it("registerAccount creates a usable AuthIdentity with verifiedAt left null and no separate activation step", async () => {
      const result = await service.registerAccount("jane@example.com", "password123", contact);

      expect(result.identity.verifiedAt).toBeNull();
      // "Usable immediately" — the very same call already returns an active session, i.e.
      // the account can be used without any further step.
      expect(result.session.authIdentityId).toBe(result.identity.id);
    });
  });

  describe("BR-AUTH-3 — Password recovery is self-service via email", () => {
    it("Flow 4: requestPasswordReset -> resetPassword changes the password and invalidates all active sessions", async () => {
      const { identity, session } = await service.registerAccount("jane@example.com", "password123", contact);
      expect(repository._sessions.has(session.id)).toBe(true);

      const resetResult = await service.requestPasswordReset("jane@example.com");
      expect(resetResult).not.toBeNull();
      expect(resetResult?.identity.id).toBe(identity.id);
      expect(resetResult?.token).toBeTruthy();

      await service.resetPassword(resetResult!.token, "new-password-456");

      // Old session invalidated (BR-AUTH-3 / Flow 4 step 3c).
      expect(repository._sessions.has(session.id)).toBe(false);
      // Old password no longer works; new one does.
      await expect(service.login("jane@example.com", "password123")).rejects.toBeInstanceOf(InvalidCredentialsError);
      await expect(service.login("jane@example.com", "new-password-456")).resolves.toBeTruthy();
    });

    it("the reset token is single-use — replaying it after redemption fails (token is keyed to the old passwordHash)", async () => {
      await service.registerAccount("jane@example.com", "password123", contact);
      const resetResult = await service.requestPasswordReset("jane@example.com");

      await service.resetPassword(resetResult!.token, "new-password-456");

      await expect(service.resetPassword(resetResult!.token, "yet-another-789")).rejects.toBeInstanceOf(
        InvalidResetTokenError,
      );
    });

    it("requestPasswordReset resolves to null for an unknown email, without throwing (generic response upstream)", async () => {
      await expect(service.requestPasswordReset("nobody@example.com")).resolves.toBeNull();
    });

    it("resetPassword throws the generic InvalidResetTokenError for a malformed/unknown token", async () => {
      await expect(service.resetPassword("not-a-real-token", "new-password-456")).rejects.toBeInstanceOf(
        InvalidResetTokenError,
      );
    });
  });

  describe("BR-AUTH-4 — Sessions are browser-session-only", () => {
    it("validateSession accepts a session with no expiresAt (v1 default) as valid indefinitely", async () => {
      const { session } = await service.registerAccount("jane@example.com", "password123", contact);
      expect(session.expiresAt).toBeNull();

      const validated = await service.validateSession(session.id);

      expect(validated).not.toBeNull();
      expect(validated?.session.id).toBe(session.id);
    });

    it("defensively honors an expiresAt in the past, if one were ever set (reserved 'remember me' field)", async () => {
      const { session } = await service.registerAccount("jane@example.com", "password123", contact);
      // No first-class API sets expiresAt in v1 — mutate the fake's stored row directly to
      // simulate a future feature that does, and confirm validateSession still respects it.
      repository._sessions.set(session.id, { ...session, expiresAt: new Date(Date.now() - 1000) });

      await expect(service.validateSession(session.id)).resolves.toBeNull();
    });
  });

  describe("BR-AUTH-5 — Two roles only: customer and owner", () => {
    it("registerAccount (the public signup path) always creates role = 'customer', never 'owner'", async () => {
      const result = await service.registerAccount("jane@example.com", "password123", contact);
      expect(result.identity.role).toBe("customer");
    });

    it("login carries through whatever role the AuthIdentity actually has, e.g. 'owner'", async () => {
      const owner = await repository.createIdentity({
        email: "owner@shop.example.com",
        passwordHash: await hashPassword("owner-password"),
        role: "owner",
        ownerId: null,
      });

      const result = await service.login("owner@shop.example.com", "owner-password");

      expect(result.identity.role).toBe("owner");
      expect(result.session.role).toBe("owner");
      expect(result.identity.id).toBe(owner.id);
    });
  });

  describe("BR-AUTH-6 — The owner login has no linked Owner record", () => {
    it("an identity created with role = 'owner' has ownerId = null, and registerAccount never produces one", async () => {
      const ownerLogin = await repository.createIdentity({
        email: "owner@shop.example.com",
        passwordHash: "irrelevant-hash",
        role: "owner",
        ownerId: null,
      });
      expect(ownerLogin.ownerId).toBeNull();

      // The public registerAccount path (Flow 2) always resolves/creates a real Owner and
      // links it — role = customer, ownerId non-null.
      const result = await service.registerAccount("jane@example.com", "password123", contact);
      expect(result.identity.role).toBe("customer");
      expect(result.identity.ownerId).not.toBeNull();
    });
  });

  describe("Flow 2 — Account Registration, error paths", () => {
    it("rejects registration when the email is already used by an existing AuthIdentity", async () => {
      await service.registerAccount("jane@example.com", "password123", contact);

      await expect(
        service.registerAccount("jane@example.com", "different-password", { ...contact, phone: "555-9999" }),
      ).rejects.toBeInstanceOf(EmailAlreadyUsedError);
    });

    it("rejects registration with an invalid email", async () => {
      await expect(service.registerAccount("not-an-email", "password123", contact)).rejects.toBeInstanceOf(
        AuthValidationError,
      );
    });

    it("rejects registration with a too-short password", async () => {
      await expect(service.registerAccount("jane@example.com", "short", contact)).rejects.toBeInstanceOf(AuthValidationError);
    });

    it("BR-CUST-4 delegation: registering with contact info matching an existing guest Owner links that Owner instead of creating a duplicate", async () => {
      // Simulate a prior guest booking having already created an Owner via the real
      // CustomerService (independent of auth) with the same email registerAccount will use.
      const customerRepository = createFakeCustomerRepository();
      const customerService = createCustomerService(customerRepository);
      const guestOwner = await customerService.createOrFindOwner(contact);

      const linkedService = createAuthService({
        repository: createFakeAuthRepository(),
        identityResolver: customerService,
      });

      const result = await linkedService.registerAccount("jane@example.com", "password123", contact);

      expect(result.identity.ownerId).toBe(guestOwner.id);
      const relinked = await customerRepository.findOwnerById(guestOwner.id);
      expect(relinked?.authIdentityId).toBe(result.identity.id);
    });
  });

  describe("Flow 3 — Login", () => {
    it("logs in successfully with correct credentials and creates a Session", async () => {
      await service.registerAccount("jane@example.com", "password123", contact);

      const result = await service.login("jane@example.com", "password123");

      expect(result.session.authIdentityId).toBe(result.identity.id);
      expect(repository._sessions.has(result.session.id)).toBe(true);
    });

    it("returns the same generic InvalidCredentialsError for an unknown email (does not reveal existence)", async () => {
      await expect(service.login("nobody@example.com", "whatever123")).rejects.toThrow("Invalid email or password");
    });

    it("returns the same generic InvalidCredentialsError message for an unknown email and for a wrong password on a known email", async () => {
      await service.registerAccount("jane@example.com", "password123", contact);

      let unknownEmailMessage = "";
      let wrongPasswordMessage = "";
      try {
        await service.login("nobody@example.com", "whatever123");
      } catch (err) {
        unknownEmailMessage = (err as Error).message;
      }
      try {
        await service.login("jane@example.com", "wrong-password");
      } catch (err) {
        wrongPasswordMessage = (err as Error).message;
      }

      expect(wrongPasswordMessage.length).toBeGreaterThan(0);
      expect(unknownEmailMessage).toBe(wrongPasswordMessage);
    });

    it("logout is idempotent — deleting an already-gone session token is not an error", async () => {
      await expect(service.logout("token-that-was-never-issued")).resolves.toBeUndefined();
    });
  });
});
