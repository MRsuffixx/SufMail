/**
 * MailForge — Encryption Utilities
 *
 * AES-256-GCM encryption/decryption for storing sensitive data
 * (IMAP/SMTP credentials) in the database.
 *
 * The ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes).
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SEPARATOR = ":";

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY env var must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts a plaintext string.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(SEPARATOR);
}

/**
 * Decrypts an encrypted string produced by `encrypt()`.
 * Throws on authentication failure (tampered data).
 */
export function decrypt(encryptedData: string): string {
  const key = getKey();
  const parts = encryptedData.split(SEPARATOR);
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  const [ivHex, tagHex, ciphertextHex] = parts as [string, string, string];

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  if (iv.length !== IV_LENGTH) throw new Error("Invalid IV length");
  if (authTag.length !== TAG_LENGTH) throw new Error("Invalid auth tag length");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Encrypts a JSON-serializable object.
 */
export function encryptObject<T>(obj: T): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypts and parses a JSON-serializable object.
 */
export function decryptObject<T>(encryptedData: string): T {
  return JSON.parse(decrypt(encryptedData)) as T;
}
