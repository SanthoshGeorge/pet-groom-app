// Manual, per-function input validation — no schema-validation library, per
// nfr-design-patterns.md's Security Patterns ("Input validation: manual, per-route
// (Q5=B)"). Applied here at the business-logic layer so these checks hold regardless of
// what a later route layer does.

import { AuthValidationError } from "./errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Login/account emails are case-insensitive for lookup purposes. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): void {
  if (!email || !EMAIL_RE.test(email.trim())) {
    throw new AuthValidationError("a valid email is required");
  }
}

/**
 * JUDGMENT CALL: no minimum password strength rule is specified anywhere in
 * business-rules.md, nfr-requirements.md, or nfr-design-patterns.md. An 8-character
 * minimum is applied here as the "sensible practices" floor NFR-4 asks for generally
 * (documented, not silently assumed) — cheap to change later without touching anything
 * else in this module.
 */
export function validatePassword(password: string): void {
  if (!password || password.length < 8) {
    throw new AuthValidationError("password must be at least 8 characters");
  }
}
