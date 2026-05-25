/**
 * MailForge — Message Domain Entity
 *
 * Pure domain entity with no Prisma coupling.
 * Contains business logic only.
 */

import type { SecurityMeta } from "~/server/security/email-security.service";

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface AttachmentInfo {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  isInline: boolean;
  contentId?: string;
  url?: string;
}

export interface LabelInfo {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  type: string;
  isSystem: boolean;
}

// ─── Message Entity ───────────────────────────────────────────────────────────

export class MessageEntity {
  readonly id: string;
  readonly messageId: string;
  readonly threadId: string | null;
  readonly subject: string | null;
  readonly fromEmail: string;
  readonly fromName: string | null;
  readonly toAddresses: EmailAddress[];
  readonly ccAddresses: EmailAddress[];
  readonly bccAddresses: EmailAddress[];
  readonly bodyHtml: string | null;
  readonly bodyText: string | null;
  readonly snippet: string | null;
  readonly isRead: boolean;
  readonly isStarred: boolean;
  readonly isSent: boolean;
  readonly isDraft: boolean;
  readonly isSpam: boolean;
  readonly isArchived: boolean;
  readonly isDeleted: boolean;
  readonly isSnoozed: boolean;
  readonly snoozeUntil: Date | null;
  readonly sentAt: Date | null;
  readonly receivedAt: Date | null;
  readonly headers: Record<string, string>;
  readonly securityMeta: SecurityMeta | null;
  readonly attachments: AttachmentInfo[];
  readonly labels: LabelInfo[];
  readonly size: number;
  readonly mailAccountId: string;
  readonly uid: number | null;
  readonly imapMailbox: string | null;

  constructor(params: {
    id: string;
    messageId: string;
    threadId: string | null;
    subject: string | null;
    fromEmail: string;
    fromName: string | null;
    toAddresses: EmailAddress[];
    ccAddresses: EmailAddress[];
    bccAddresses: EmailAddress[];
    bodyHtml: string | null;
    bodyText: string | null;
    snippet: string | null;
    isRead: boolean;
    isStarred: boolean;
    isSent: boolean;
    isDraft: boolean;
    isSpam: boolean;
    isArchived: boolean;
    isDeleted: boolean;
    isSnoozed: boolean;
    snoozeUntil: Date | null;
    sentAt: Date | null;
    receivedAt: Date | null;
    headers: Record<string, string>;
    securityMeta: SecurityMeta | null;
    attachments: AttachmentInfo[];
    labels: LabelInfo[];
    size: number;
    mailAccountId: string;
    uid: number | null;
    imapMailbox: string | null;
  }) {
    this.id = params.id;
    this.messageId = params.messageId;
    this.threadId = params.threadId;
    this.subject = params.subject;
    this.fromEmail = params.fromEmail;
    this.fromName = params.fromName;
    this.toAddresses = params.toAddresses;
    this.ccAddresses = params.ccAddresses;
    this.bccAddresses = params.bccAddresses;
    this.bodyHtml = params.bodyHtml;
    this.bodyText = params.bodyText;
    this.snippet = params.snippet;
    this.isRead = params.isRead;
    this.isStarred = params.isStarred;
    this.isSent = params.isSent;
    this.isDraft = params.isDraft;
    this.isSpam = params.isSpam;
    this.isArchived = params.isArchived;
    this.isDeleted = params.isDeleted;
    this.isSnoozed = params.isSnoozed;
    this.snoozeUntil = params.snoozeUntil;
    this.sentAt = params.sentAt;
    this.receivedAt = params.receivedAt;
    this.headers = params.headers;
    this.securityMeta = params.securityMeta;
    this.attachments = params.attachments;
    this.labels = params.labels;
    this.size = params.size;
    this.mailAccountId = params.mailAccountId;
    this.uid = params.uid;
    this.imapMailbox = params.imapMailbox;
  }

  // ─── Business Logic ───────────────────────────────────────────────────────

  /**
   * Returns the effective display name for the sender.
   */
  get senderDisplay(): string {
    return this.fromName ?? this.fromEmail;
  }

  /**
   * Returns whether this message is a phishing risk.
   */
  isPhishingRisk(): boolean {
    if (!this.securityMeta) return false;
    return (
      this.securityMeta.phishing.riskLevel === "high" ||
      this.securityMeta.phishing.riskLevel === "critical"
    );
  }

  /**
   * Returns a safe text snippet for preview display.
   */
  getSnippet(maxLength = 200): string {
    if (this.snippet) return this.snippet.slice(0, maxLength);
    const text = this.bodyText ?? "";
    return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  /**
   * Returns whether this message has non-inline attachments.
   */
  hasAttachments(): boolean {
    return this.attachments.some((a) => !a.isInline);
  }

  /**
   * Returns the count of non-inline attachments.
   */
  get attachmentCount(): number {
    return this.attachments.filter((a) => !a.isInline).length;
  }

  /**
   * Returns the SPF/DKIM/DMARC authentication summary.
   */
  get authSummary(): string {
    if (!this.securityMeta) return "unknown";
    const { spf, dkim, dmarc } = this.securityMeta.auth;
    if (dmarc === "pass") return "authenticated";
    if (spf === "pass" && dkim === "pass") return "authenticated";
    if (spf === "fail" || dkim === "fail") return "failed";
    return "partial";
  }
}
