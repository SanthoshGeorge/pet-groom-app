// auth module (AuthService) — Code Generation Phase B, Step 3.
// Implements BR-AUTH-1..6 (business-rules.md) and Flows 2, 3, 4 (business-logic-model.md).

export type { AuthIdentity, AuthRole, PublicAuthIdentity, Session, ValidatedSession } from "./types";
export {
  AuthValidationError,
  EmailAlreadyUsedError,
  InvalidCredentialsError,
  InvalidResetTokenError,
} from "./errors";
export type { AuthRepository, CreateIdentityInput, CreateSessionInput } from "./repository";
export { createAuthService } from "./service";
export type {
  AuthService,
  AuthServiceDependencies,
  ContactInfo,
  LoginResult,
  OwnerIdentityResolver,
  RequestPasswordResetResult,
} from "./service";
export { hashPassword, verifyPassword } from "./password";
