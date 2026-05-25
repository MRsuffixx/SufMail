/**
 * MailForge — Key Management Service
 *
 * Envelope encryption with per-user derived keys.
 * Uses HKDF to derive per-user sub-keys from the global master key.
 * Supports key versioning for key rotation.
 *
 * Encryption format: `v<version>:<iv_hex>:<tag_hex>:<ciphertext_hex>`
 */

import crypto from "crypto";
import { db } from "~/server/db";

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const VERSION_PREFIX_RE = /^v(\d+):/;

// ─── Key Resolution ───────────────────────────────────────────────────────────

/**
 * Resolves the raw key Buffer for a given version number.
 * Version 1 uses ENCRYPTION_KEY, higher versions use ENCRYPTION_KEY_V<n>.
 */
function resolveKeyForVersion(version: number): Buffer {
  const envKey =
    version === 1
      ? process.env.ENCRYPTION_KEY
      : process.env[`ENCRYPTION_KEY_V${version}`];

  if (!envKey || envKey.length !== 64) {
    throw new Error(
      `No valid encryption key found for version ${version}. ` +
        `Set ENCRYPTION_KEY (v1) or ENCRYPTION_KEY_V${version} (64-char hex) in your environment.`,
    );
  }
  return Buffer.from(envKey, "hex");
}

/**
 * Returns the current active key version from environment.
 */
function getActiveKeyVersion(): number {
  return Number(process.env.ENCRYPTION_KEY_VERSION ?? "1");
}

// ─── KMS Service ──────────────────────────────────────────────────────────────

export class KeyManagementService {
  // ─── User Key Management ──────────────────────────────────────────────

  /**
   * Gets or creates the per-user salt stored in UserKeySalt.
   * Salt is stable per user and changes only on explicit rotation.
   * Uses upsert to prevent race conditions between concurrent calls.
   */
  static async getUserSalt(userId: string): Promise<Buffer> {
    const existing = await db.userKeySalt.findUnique({ where: { userId } });
    if (existing) {
      return Buffer.from(existing.salt, "hex");
    }
    const salt = crypto.randomBytes(SALT_LENGTH);
    try {
      await db.userKeySalt.create({
        data: { userId, salt: salt.toString("hex") },
      });
    } catch (err) {
      const dupErr = err as { code?: string };
      if (dupErr.code !== "P2002") throw err;
    }
    const saved = await db.userKeySalt.findUnique({ where: { userId } });
    return Buffer.from(saved!.salt, "hex");
  }

  /**
   * Derives a per-user AES-256-GCM key from the master key + user salt
   * using HKDF-SHA256.
   */
  private static async deriveUserKey(
    userId: string,
    keyVersion: number,
  ): Promise<Buffer> {
    const masterKey = resolveKeyForVersion(keyVersion);
    const salt = await KeyManagementService.getUserSalt(userId);

    return new Promise<Buffer>((resolve, reject) => {
      crypto.hkdf(
        "sha256",
        masterKey,
        salt,
        Buffer.from(`mailforge-user-key:${userId}`),
        32, // 256-bit output
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(Buffer.from(derivedKey));
        },
      );
    });
  }

  // ─── Encryption / Decryption ──────────────────────────────────────────

  /**
   * Encrypts plaintext for a specific user using the active key version.
   * Returns a versioned ciphertext string: `v<version>:<iv>:<tag>:<ciphertext>`
   */
  static async encryptForUser(userId: string, plaintext: string): Promise<string> {
    const version = getActiveKeyVersion();
    const key = await KeyManagementService.deriveUserKey(userId, version);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      `v${version}`,
      iv.toString("hex"),
      authTag.toString("hex"),
      encrypted.toString("hex"),
    ].join(":");
  }

  /**
   * Decrypts a versioned ciphertext string for a specific user.
   */
  static async decryptForUser(userId: string, ciphertext: string): Promise<string> {
    const match = VERSION_PREFIX_RE.exec(ciphertext);
    let version: number;
    let rest: string;

    if (match?.[1]) {
      version = parseInt(match[1], 10);
      rest = ciphertext.slice(match[0].length);
    } else {
      // Legacy v1 format (no version prefix) — fall through to legacy decrypt
      throw new Error(
        "Cannot decrypt legacy format with KMS — use legacy crypto.ts decrypt() for migration.",
      );
    }

    const parts = rest.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid KMS ciphertext format — expected v<n>:iv:tag:ciphertext");
    }
    const [ivHex, tagHex, ciphertextHex] = parts as [string, string, string];

    const key = await KeyManagementService.deriveUserKey(userId, version);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const encrypted = Buffer.from(ciphertextHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  /**
   * Encrypts a JSON-serializable object for a user.
   */
  static async encryptObjectForUser<T>(userId: string, obj: T): Promise<string> {
    return KeyManagementService.encryptForUser(userId, JSON.stringify(obj));
  }

  /**
   * Decrypts a JSON-serializable object for a user.
   */
  static async decryptObjectForUser<T>(userId: string, ciphertext: string): Promise<T> {
    const json = await KeyManagementService.decryptForUser(userId, ciphertext);
    return JSON.parse(json) as T;
  }

  // ─── Key Rotation ─────────────────────────────────────────────────────

  /**
   * Returns the list of account IDs whose credentials need re-encryption
   * after a key version bump. Used by the re-encryption BullMQ job.
   */
  static async getAccountsNeedingReEncryption(
    oldVersion: number,
  ): Promise<string[]> {
    const accounts = await db.mailAccount.findMany({
      where: { credentialKeyVersion: oldVersion },
      select: { id: true },
    });
    return accounts.map((a) => a.id);
  }

  /**
   * Re-encrypts a single MailAccount's credentials from oldVersion to the
   * active key version. Run in batches from the re-encryption job.
   */
  static async reEncryptAccount(accountId: string): Promise<void> {
    const account = await db.mailAccount.findUniqueOrThrow({
      where: { id: accountId },
      select: {
        id: true,
        userId: true,
        credentials: true,
        credentialKeyVersion: true,
      },
    });

    const activeVersion = getActiveKeyVersion();
    if (account.credentialKeyVersion === activeVersion) return; // Already current

    let plaintext: string;
    if (account.credentialKeyVersion === 0) {
      // Version 0 = legacy flat AES (from crypto.ts)
      const { decrypt } = await import("~/lib/crypto");
      plaintext = decrypt(account.credentials);
    } else {
      plaintext = await KeyManagementService.decryptForUser(
        account.userId,
        account.credentials,
      );
    }

    const newCiphertext = await KeyManagementService.encryptForUser(
      account.userId,
      plaintext,
    );

    await db.mailAccount.update({
      where: { id: accountId },
      data: {
        credentials: newCiphertext,
        credentialKeyVersion: activeVersion,
      },
    });
  }
}
