// Password hashing — tech-stack-decisions.md is explicit: "bcrypt or argon2 (standard
// library, not custom crypto — NFR-4's 'sensible practices' bar)". `bcryptjs` is a pure-JS
// bcrypt implementation (no native build step, so it can't hit the same
// binaries-download restriction that blocks the Prisma CLI in this environment).

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash);
}
