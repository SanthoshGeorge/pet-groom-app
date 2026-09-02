// auth module error types — thrown by service.ts, mapped to HTTP responses by the API
// layer (Code Generation Step 12, out of scope here).
//
// InvalidCredentialsError and InvalidResetTokenError carry deliberately generic messages
// per Flow 3/Flow 4 of business-logic-model.md — callers must not use anything about
// *which* precondition failed to reveal whether an email/account exists.

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

/** Flow 3 — "generic invalid credentials" regardless of whether the email doesn't exist or the password is wrong. */
export class InvalidCredentialsError extends Error {
  constructor(message = "Invalid email or password") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

/** Flow 2, step 1. */
export class EmailAlreadyUsedError extends Error {
  constructor(message = "An account with this email already exists") {
    super(message);
    this.name = "EmailAlreadyUsedError";
  }
}

/** Flow 4, step 3a — generic regardless of whether the token is malformed, expired, unknown, or already used. */
export class InvalidResetTokenError extends Error {
  constructor(message = "This password reset link is invalid or has expired") {
    super(message);
    this.name = "InvalidResetTokenError";
  }
}
