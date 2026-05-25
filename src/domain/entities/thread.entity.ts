/**
 * MailForge — Thread Domain Entity
 *
 * Pure domain entity with no Prisma coupling.
 */

import type { MessageEntity } from "./message.entity";

export class ThreadEntity {
  readonly id: string;
  readonly subject: string;
  readonly messages: MessageEntity[];
  readonly participantEmails: string[];
  readonly lastMessageAt: Date;
  readonly messageCount: number;
  readonly unreadCount: number;
  readonly labelIds: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    subject: string;
    messages: MessageEntity[];
    participantEmails: string[];
    lastMessageAt: Date;
    messageCount: number;
    unreadCount: number;
    labelIds: string[];
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.subject = params.subject;
    this.messages = params.messages;
    this.participantEmails = params.participantEmails;
    this.lastMessageAt = params.lastMessageAt;
    this.messageCount = params.messageCount;
    this.unreadCount = params.unreadCount;
    this.labelIds = params.labelIds;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  // ─── Business Logic ───────────────────────────────────────────────────────

  /**
   * Returns the most recent message in the thread.
   */
  getLatestMessage(): MessageEntity | null {
    if (this.messages.length === 0) return null;
    return this.messages.reduce((latest, msg) => {
      const latestDate = latest.receivedAt ?? new Date(0);
      const msgDate = msg.receivedAt ?? new Date(0);
      return msgDate > latestDate ? msg : latest;
    });
  }

  /**
   * Returns the count of unread messages.
   */
  getUnreadCount(): number {
    return this.messages.filter((m) => !m.isRead).length;
  }

  /**
   * Returns whether the thread has any unread messages.
   */
  hasUnread(): boolean {
    return this.messages.some((m) => !m.isRead);
  }

  /**
   * Returns participant emails, excluding the given user email (for display).
   */
  getOtherParticipants(userEmail: string): string[] {
    return this.participantEmails.filter(
      (e) => e.toLowerCase() !== userEmail.toLowerCase(),
    );
  }

  /**
   * Returns whether any message in this thread is a phishing risk.
   */
  hasPhishingRisk(): boolean {
    return this.messages.some((m) => m.isPhishingRisk());
  }
}
