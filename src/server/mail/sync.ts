/**
 * MailForge — Mail Sync Service (v2)
 *
 * Production-grade sync pipeline:
 * 1. Fetch UIDs since checkpoint (incremental)
 * 2. Deduplicate before DB write
 * 3. RFC-compliant thread building
 * 4. Email security analysis
 * 5. Attachment upload
 * 6. Checkpoint save after each batch (crash-safe)
 * 7. Circuit breaker on consecutive failures
 */

import { db } from "~/server/db";
import { ImapService } from "./imap";
import { ThreadBuilderService } from "./thread-builder.service";
import { DeduplicationService } from "./dedup.service";
import { SyncCheckpointService } from "./sync-checkpoint.service";
import { EmailSecurityService } from "~/server/security/email-security.service";
import { getMessageSnippet } from "~/lib/mail-utils";
import { uploadFile, generateAttachmentKey } from "~/lib/storage";
import { syncLogger } from "~/lib/logger";
import {
  messagesSyncedTotal,
  syncErrorsTotal,
} from "~/server/observability/metrics.service";
import type { ParsedEmail } from "~/types/mail";
import type { SyncResult } from "~/types/mail";
import type { MailAccount } from "../../../generated/prisma";

// Maps IMAP mailbox names to system label types.
const IMAP_MAILBOX_LABEL_MAP: Record<string, string> = {
  INBOX: "INBOX",
  Sent: "SENT",
  Drafts: "DRAFTS",
  Draft: "DRAFTS",
  Trash: "TRASH",
  Junk: "SPAM",
  Archive: "ARCHIVE",
  Archives: "ARCHIVE",
};

const CHECKPOINT_BATCH_SIZE = 10; // Save checkpoint every N messages
const MAX_CONSECUTIVE_FAILURES = 5;
const MESSAGES_PER_MAILBOX = 200;

// ─── Sync Service ─────────────────────────────────────────────────────────────

export class SyncService {
  /**
   * Syncs a single mail account incrementally using UID checkpoints.
   * Crash-safe: checkpoints saved every batch.
   * Circuit breaker: disables account after N consecutive failures.
   */
  static async syncAccount(mailAccountId: string): Promise<SyncResult> {
    const result: SyncResult = {
      mailAccountId,
      messagesAdded: 0,
      messagesUpdated: 0,
      errors: [],
      syncedAt: new Date(),
    };

    const account = await db.mailAccount.findUnique({
      where: { id: mailAccountId },
    });

    if (!account || !account.isActive) {
      result.errors.push(`Account ${mailAccountId} not found or inactive`);
      return result;
    }

    const imap = new ImapService(account);
    try {
      await imap.connect();
      const mailboxes = await imap.getMailboxes();

      const syncMailboxes = mailboxes.filter(
        (mb) =>
          mb.path === "INBOX" ||
          Object.keys(IMAP_MAILBOX_LABEL_MAP).some((key) =>
            mb.name.toLowerCase().includes(key.toLowerCase()),
          ),
      );

      for (const mailbox of syncMailboxes) {
        try {
          await SyncService.syncMailbox(account, imap, mailbox.path, result);
        } catch (err) {
          const msg = `Failed to sync mailbox ${mailbox.path}: ${String(err)}`;
          result.errors.push(msg);
          syncLogger.error(
            { accountId: mailAccountId, mailbox: mailbox.path, err },
            "[Sync] Mailbox sync failed",
          );
          syncErrorsTotal.labels(mailAccountId, "mailbox_error").inc();
          result.mailboxErrors = (result.mailboxErrors ?? 0) + 1;
        }
      }

      if (!result.mailboxErrors || result.mailboxErrors === 0) {
        // Reset consecutive failure counter on full success
        await db.mailAccount.update({
          where: { id: mailAccountId },
          data: {
            syncedAt: new Date(),
            consecutiveSyncFailures: 0,
          },
        });
      } else {
        await db.mailAccount.update({
          where: { id: mailAccountId },
          data: { syncedAt: new Date() },
        });
      }
    } catch (err) {
      const msg = `IMAP connection failed: ${String(err)}`;
      result.errors.push(msg);
      syncLogger.error({ accountId: mailAccountId, err }, "[Sync] Connection failed");
      syncErrorsTotal.labels(mailAccountId, "connection_error").inc();

      // Increment failure counter; disable account if threshold reached
      const updated = await db.mailAccount.update({
        where: { id: mailAccountId },
        data: { consecutiveSyncFailures: { increment: 1 } },
        select: { consecutiveSyncFailures: true },
      });

      if (updated.consecutiveSyncFailures >= MAX_CONSECUTIVE_FAILURES) {
        await db.mailAccount.update({
          where: { id: mailAccountId },
          data: { isActive: false },
        });
        syncLogger.warn(
          { accountId: mailAccountId },
          "[Sync] Account disabled after consecutive failures",
        );
      }
    } finally {
      await imap.disconnect();
    }

    return result;
  }

  /**
   * Syncs a single mailbox incrementally using UID checkpoints.
   */
  private static async syncMailbox(
    account: MailAccount,
    imap: ImapService,
    mailboxPath: string,
    result: SyncResult,
  ): Promise<void> {
    const sinceUid = await SyncCheckpointService.getCheckpoint(
      account.id,
      mailboxPath,
    );

    const since =
      sinceUid === 0
        ? account.syncedAt ?? undefined
        : undefined; // UID-based fetch is preferred

    const messages = await imap.fetchMessages(
      mailboxPath,
      since,
      MESSAGES_PER_MAILBOX,
    );

    syncLogger.info(
      {
        accountId: account.id,
        mailbox: mailboxPath,
        count: messages.length,
        sinceUid,
      },
      "[Sync] Fetched messages",
    );

    let batchCount = 0;
    let lastProcessedUid = sinceUid;

    for (const parsed of messages) {
      try {
        const isDup = await DeduplicationService.isDuplicate(account.id, parsed);
        if (isDup) {
          syncLogger.debug(
            { messageId: parsed.messageId },
            "[Sync] Skipping duplicate",
          );
          continue;
        }

        await SyncService.upsertMessage(account, parsed, mailboxPath);
        result.messagesAdded++;
        messagesSyncedTotal.labels(account.id, mailboxPath).inc();

        if (parsed.uid && parsed.uid > lastProcessedUid) {
          lastProcessedUid = parsed.uid;
        }

        batchCount++;
        // Save checkpoint every CHECKPOINT_BATCH_SIZE messages
        if (batchCount % CHECKPOINT_BATCH_SIZE === 0 && lastProcessedUid > 0) {
          await SyncCheckpointService.saveCheckpoint(
            account.id,
            mailboxPath,
            lastProcessedUid,
          );
        }
      } catch (err) {
        result.errors.push(
          `Failed to upsert message ${parsed.messageId}: ${String(err)}`,
        );
        syncLogger.error(
          { messageId: parsed.messageId, err },
          "[Sync] Upsert failed",
        );
      }
    }

    // Final checkpoint save
    if (lastProcessedUid > sinceUid) {
      await SyncCheckpointService.saveCheckpoint(
        account.id,
        mailboxPath,
        lastProcessedUid,
      );
    }
  }

  /**
   * Upserts a single parsed email into the database.
   * Handles thread grouping, security analysis, label assignment, attachments.
   */
  static async upsertMessage(
    account: MailAccount,
    parsed: ParsedEmail,
    mailboxPath: string,
  ): Promise<void> {
    // Thread resolution (RFC 2822 graph + fuzzy subject fallback)
    const threadId = await ThreadBuilderService.findOrCreateThread(
      account,
      parsed,
    );

    // Security analysis
    const securityMeta = await EmailSecurityService.analyzeMessage({
      headers: parsed.headers,
      subject: parsed.subject,
      fromEmail: parsed.from.email,
      bodyHtml: parsed.bodyHtml ?? undefined,
      bodyText: parsed.bodyText ?? undefined,
    });

    // Message hash for deduplication storage
    const messageHash = DeduplicationService.computeMessageHash(parsed);

    // Determine label type from mailbox
    const mailboxName = Object.keys(IMAP_MAILBOX_LABEL_MAP).find((key) =>
      mailboxPath.toLowerCase().includes(key.toLowerCase()),
    );
    const labelType = mailboxName
      ? IMAP_MAILBOX_LABEL_MAP[mailboxName]
      : "INBOX";

    // Get system label for this user
    const label = await db.label.findFirst({
      where: {
        userId: account.userId,
        type: labelType as
          | "INBOX"
          | "SENT"
          | "DRAFTS"
          | "TRASH"
          | "SPAM"
          | "ARCHIVE"
          | "CUSTOM",
        isSystem: true,
      },
    });

    const isSent = labelType === "SENT";
    const isDraft = labelType === "DRAFTS";
    const isSpam = labelType === "SPAM";
    const isArchived = labelType === "ARCHIVE";
    const isDeleted = labelType === "TRASH";

    const message = await db.message.upsert({
      where: {
        mailAccountId_messageId: {
          mailAccountId: account.id,
          messageId: parsed.messageId,
        },
      },
      create: {
        mailAccountId: account.id,
        messageId: parsed.messageId,
        threadId,
        subject: parsed.subject,
        fromEmail: parsed.from.email,
        fromName: parsed.from.name ?? null,
        toAddresses: JSON.stringify(parsed.to),
        ccAddresses: JSON.stringify(parsed.cc),
        bccAddresses: JSON.stringify(parsed.bcc),
        bodyHtml: parsed.bodyHtml || null,
        bodyText: parsed.bodyText || null,
        snippet: getMessageSnippet(parsed.bodyText || parsed.bodyHtml || ""),
        isRead: false,
        isStarred: false,
        isSent,
        isDraft,
        isSpam,
        isArchived,
        isDeleted,
        sentAt: isSent ? (parsed.date ?? null) : null,
        receivedAt: parsed.date ?? new Date(),
        headers: JSON.stringify(parsed.headers),
        securityMeta: securityMeta as unknown as Record<string, unknown>,
        messageHash: messageHash ?? null,
        uid: parsed.uid ?? null,
        imapMailbox: mailboxPath,
        size: parsed.bodyHtml?.length ?? parsed.bodyText?.length ?? 0,
      },
      update: {
        isRead: isDeleted || isSent,
        isSent,
        isDraft,
        isSpam,
        isArchived,
        isDeleted,
        // Refresh security meta on update
        securityMeta: securityMeta as unknown as Record<string, unknown>,
      },
    });

    // Assign label
    if (label) {
      await db.messageLabel.upsert({
        where: {
          messageId_labelId: {
            messageId: message.id,
            labelId: label.id,
          },
        },
        create: { messageId: message.id, labelId: label.id },
        update: {},
      });
    }

    // Process and store attachments
    for (const attachment of parsed.attachments) {
      const storageKey = generateAttachmentKey(
        account.userId,
        message.id,
        attachment.filename,
      );

      try {
        await uploadFile(attachment.content, storageKey, attachment.mimeType);

        await db.attachment.upsert({
          where: {
            // Identify existing attachment by messageId + filename (stable across re-syncs)
            messageId_filename: {
              messageId: message.id,
              filename: attachment.filename,
            },
          },
          create: {
            messageId: message.id,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
            storageKey,
            isInline: attachment.isInline,
            contentId: attachment.contentId ?? null,
          },
          update: {
            storageKey,
            mimeType: attachment.mimeType,
            size: attachment.size,
            isInline: attachment.isInline,
            contentId: attachment.contentId ?? null,
          },
        });
      } catch (err) {
        syncLogger.error(
          { filename: attachment.filename, err },
          "[Sync] Attachment storage failed",
        );
      }
    }
  }
}

// ─── System Labels ────────────────────────────────────────────────────────────

/**
 * Creates system labels (INBOX, SENT, DRAFTS, TRASH, SPAM, ARCHIVE) for a new user.
 */
export async function createSystemLabels(userId: string): Promise<void> {
  const systemLabels: Array<{
    name: string;
    type: "INBOX" | "SENT" | "DRAFTS" | "TRASH" | "SPAM" | "ARCHIVE";
    icon: string;
    color: string;
    order: number;
  }> = [
    { name: "Inbox", type: "INBOX", icon: "📥", color: "#4f46e5", order: 0 },
    { name: "Sent", type: "SENT", icon: "📤", color: "#059669", order: 1 },
    { name: "Drafts", type: "DRAFTS", icon: "📝", color: "#d97706", order: 2 },
    { name: "Trash", type: "TRASH", icon: "🗑️", color: "#dc2626", order: 3 },
    { name: "Spam", type: "SPAM", icon: "⚠️", color: "#ea580c", order: 4 },
    { name: "Archive", type: "ARCHIVE", icon: "📦", color: "#6b7280", order: 5 },
  ];

  await db.label.createMany({
    data: systemLabels.map((l) => ({
      userId,
      name: l.name,
      type: l.type,
      icon: l.icon,
      color: l.color,
      isSystem: true,
      order: l.order,
    })),
    skipDuplicates: true,
  });
}
