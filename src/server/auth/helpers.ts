/**
 * MailForge — Auth Helpers
 *
 * Helper functions for authentication: password hashing and verification.
 */

import bcryptjs from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}
