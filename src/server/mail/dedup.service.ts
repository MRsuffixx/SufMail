/**
 * MailForge — Deduplication Service
 *
 * Prevents duplicate messages during sync operations using SHA-256
 * content hashes as stable idempotency keys.
 */

import crypto from "crypto";
import { db } from "~/server/db";
import type { ParsedEmail } from "~/types/mail";

export class DeduplicationService {
  /**
   * Computes a SHA-256 content hash: fromEmail + ISO date + bodyText[0:500].
   * Public so it can be called directly for storage during upsert.
   */
  static computeMessageHash(parsed: ParsedEmail): string {
    const dateStr = parsed.date?.toISOString() ?? "";
    const bodySnippet = (parsed.bodyText ?? "").slice(0, 500);
    const raw = `${parsed.from.email}|${dateStr}|${bodySnippet}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  /**
   * Generates an idempotency key from account + IMAP UID + mailbox.
   * Stable across re-syncs of the same message.
   */
  static generateIdempotencyKey(
    accountId: string,
    uid: number,
    mailbox: string,
  ): string {
    return crypto
      .createHash("sha256")
      .update(`${accountId}:${mailbox}:${uid}`)
      .digest("hex");
  }

  /**
   * Returns true if a message with the same RFC Message-ID or content hash
   * already exists for this account.
   */
  static async isDuplicate(
    accountId: string,
    parsed: ParsedEmail,
  ): Promise<boolean> {
    // Primary: RFC Message-ID (fast, indexed)
    const byMessageId = await db.message.findFirst({
      where: {
        mailAccountId: accountId,
        messageId: parsed.messageId,
      },
      select: { id: true },
    });
    if (byMessageId) return true;

    // Secondary: content hash (handles malformed/duplicate IDs)
    const hash = DeduplicationService.computeMessageHash(parsed);
    const byHash = await db.message.findFirst({
      where: {
        mailAccountId: accountId,
        messageHash: hash,
      },
      select: { id: true },
    });
    return byHash !== null;
  }
}
