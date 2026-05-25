/**
 * MailForge — Message Domain Mapper
 *
 * Converts between Prisma DB records and MessageEntity domain objects.
 */

import { MessageEntity } from "~/domain/entities/message.entity";
import type {
  EmailAddress,
  AttachmentInfo,
  LabelInfo,
} from "~/domain/entities/message.entity";
import type { SecurityMeta } from "~/server/security/email-security.service";
import type { Message, Attachment } from "../../../generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

type PrismaMessageWithRelations = Message & {
  attachments?: Attachment[];
  messageLabels?: Array<{
    label: {
      id: string;
      name: string;
      color: string | null;
      icon: string | null;
      type: string;
      isSystem: boolean;
    };
  }>;
};

// ─── Mapper ───────────────────────────────────────────────────────────────────

export const MessageMapper = {
  /**
   * Converts a Prisma Message (with optional relations) to a MessageEntity.
   */
  fromPrisma(msg: PrismaMessageWithRelations): MessageEntity {
    const toAddresses = (msg.toAddresses as unknown as EmailAddress[]) ?? [];
    const ccAddresses = (msg.ccAddresses as unknown as EmailAddress[]) ?? [];
    const bccAddresses = (msg.bccAddresses as unknown as EmailAddress[]) ?? [];
    const headers = (msg.headers as Record<string, string>) ?? {};
    const securityMeta = msg.securityMeta
      ? (msg.securityMeta as unknown as SecurityMeta)
      : null;

    const attachments: AttachmentInfo[] = (msg.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      storageKey: a.storageKey,
      isInline: a.isInline,
      contentId: a.contentId ?? undefined,
    }));

    const labels: LabelInfo[] = (msg.messageLabels ?? []).map((ml) => ({
      id: ml.label.id,
      name: ml.label.name,
      color: ml.label.color,
      icon: ml.label.icon,
      type: ml.label.type,
      isSystem: ml.label.isSystem,
    }));

    return new MessageEntity({
      id: msg.id,
      messageId: msg.messageId,
      threadId: msg.threadId,
      subject: msg.subject,
      fromEmail: msg.fromEmail,
      fromName: msg.fromName,
      toAddresses,
      ccAddresses,
      bccAddresses,
      bodyHtml: msg.bodyHtml,
      bodyText: msg.bodyText,
      snippet: msg.snippet,
      isRead: msg.isRead,
      isStarred: msg.isStarred,
      isSent: msg.isSent,
      isDraft: msg.isDraft,
      isSpam: msg.isSpam,
      isArchived: msg.isArchived,
      isDeleted: msg.isDeleted,
      isSnoozed: msg.isSnoozed,
      snoozeUntil: msg.snoozeUntil,
      sentAt: msg.sentAt,
      receivedAt: msg.receivedAt,
      headers,
      securityMeta,
      attachments,
      labels,
      size: msg.size,
      mailAccountId: msg.mailAccountId,
      uid: msg.uid,
      imapMailbox: msg.imapMailbox,
    });
  },
};
