/**
 * MailForge — Mail Sync Service
 *
 * Syncs IMAP messages to the database.
 * Handles upsert, thread grouping, label assignment, and attachment storage.
 */

import { db } from "~/server/db";
import { ImapService } from "./imap";
import { getMessageSnippet, buildThreadId, isThreadContinuation } from "~/lib/mail-utils";
import { uploadFile, generateAttachmentKey, generateRawMessageKey } from "~/lib/storage";
import type { ParsedEmail } from "~/types/mail";
import type { SyncResult } from "~/types/mail";
import type { MailAccount } from "../../../generated/prisma";

// Maps IMAP mailbox names to system label types.
// "Junk" is the RFC 6154 standard special-use attribute; "Spam" is a
// provider-specific alias. We keep "Junk" as the canonical entry.
const IMAP_MAILBOX_LABEL_MAP: Record<string, string> = {
  INBOX: "INBOX",
  Sent: "SENT",
  Drafts: "DRAFTS",
  Draft: "DRAFTS",
  Trash: "TRASH",
  Junk: "SPAM",    // RFC 6154 \Junk special-use attribute
  Archive: "ARCHIVE",
  Archives: "ARCHIVE",
};

// ─── Sync Service ─────────────────────────────────────────────────────────────

export class SyncService {
  /**
   * Syncs a single mail account — fetches new messages since last sync,
   * upserts them into the database, assigns labels, and stores attachments.
   *
   * @param mailAccountId - The MailAccount ID to sync
   * @returns SyncResult with counts and any errors
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

      // Get list of mailboxes to sync
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
          const messages = await imap.fetchMessages(
            mailbox.path,
            account.syncedAt ?? undefined,
            200,
          );

          for (const parsed of messages) {
            try {
              await SyncService.upsertMessage(account, parsed, mailbox.path);
              result.messagesAdded++;
            } catch (err) {
              result.errors.push(
                `Failed to upsert message ${parsed.messageId}: ${String(err)}`,
              );
            }
          }
        } catch (err) {
          result.errors.push(
            `Failed to sync mailbox ${mailbox.path}: ${String(err)}`,
          );
        }
      }

      // Update syncedAt timestamp
      await db.mailAccount.update({
        where: { id: mailAccountId },
        data: { syncedAt: new Date() },
      });
    } catch (err) {
      result.errors.push(`IMAP connection failed: ${String(err)}`);
    } finally {
      await imap.disconnect();
    }

    return result;
  }

  /**
   * Upserts a single parsed email into the database.
   * Handles thread grouping, label assignment, and attachment upload.
   */
  static async upsertMessage(
    account: MailAccount,
    parsed: ParsedEmail,
    mailboxPath: string,
  ): Promise<void> {
    // Determine thread ID
    const threadId = buildThreadId(
      parsed.references.join(" ") || null,
      parsed.messageId,
    );

    // Determine label type from mailbox
    const mailboxName = Object.keys(IMAP_MAILBOX_LABEL_MAP).find((key) =>
      mailboxPath.toLowerCase().includes(key.toLowerCase()),
    );
    const labelType = mailboxName
      ? IMAP_MAILBOX_LABEL_MAP[mailboxName]
      : "INBOX";

    // Get or create system label for this user
    const label = await db.label.findFirst({
      where: {
        userId: account.userId,
        type: labelType as "INBOX" | "SENT" | "DRAFTS" | "TRASH" | "SPAM" | "ARCHIVE" | "CUSTOM",
        isSystem: true,
      },
    });

    // Upsert the Thread
    const thread = await db.thread.upsert({
      where: { id: threadId },
      create: {
        id: threadId,
        subject: parsed.subject,
        participantEmails: JSON.stringify([parsed.from.email]),
        messageCount: 1,
        unreadCount: 1,
        lastMessageAt: parsed.date ?? new Date(),
        labelIds: label ? JSON.stringify([label.id]) : JSON.stringify([]),
      },
      update: {
        lastMessageAt: parsed.date ?? new Date(),
        messageCount: { increment: 1 },
        unreadCount: { increment: 1 },
      },
    });

    // Determine message flags
    const isSent = labelType === "SENT";
    const isDraft = labelType === "DRAFTS";
    const isSpam = labelType === "SPAM";
    const isArchived = labelType === "ARCHIVE";
    const isDeleted = labelType === "TRASH";

    // Upsert the Message
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
        threadId: thread.id,
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
        uid: parsed.uid ?? null,
        imapMailbox: mailboxPath,
        size: parsed.bodyHtml?.length ?? 0,
      },
      update: {
        // Update flags that may have changed
        isRead: isDeleted || isSent,
        isSent,
        isDraft,
        isSpam,
        isArchived,
        isDeleted,
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
        create: {
          messageId: message.id,
          labelId: label.id,
        },
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

        await db.attachment.create({
          data: {
            messageId: message.id,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
            storageKey,
            isInline: attachment.isInline,
            contentId: attachment.contentId ?? null,
          },
        });
      } catch (err) {
        console.error(
          `[Sync] Failed to store attachment ${attachment.filename}:`,
          err,
        );
      }
    }
  }
}

/**
 * Creates system labels (INBOX, SENT, DRAFTS, TRASH, SPAM, ARCHIVE) for a new user.
 * Called in the NextAuth `createUser` event.
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
