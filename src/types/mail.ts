/**
 * MailForge — Shared Mail Type Definitions
 *
 * All core domain types used across the server and client.
 */

// ─── Email Address ────────────────────────────────────────────────────────────

export interface EmailAddress {
  name?: string;
  email: string;
}

// ─── Parsed Email (from mailparser) ──────────────────────────────────────────

export interface ParsedAttachment {
  filename: string;
  mimeType: string;
  size: number;
  content: Buffer;
  contentId?: string;
  isInline: boolean;
}

export interface ParsedEmail {
  messageId: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  replyTo?: EmailAddress;
  inReplyTo?: string;
  references: string[];
  bodyHtml: string;
  bodyText: string;
  attachments: ParsedAttachment[];
  headers: Record<string, string>;
  date?: Date;
  uid?: number;
  mailbox?: string;
}

// ─── Message List Item (for inbox listing) ────────────────────────────────────

export interface MessageListItem {
  id: string;
  threadId: string | null;
  messageId: string;
  subject: string | null;
  fromEmail: string;
  fromName: string | null;
  snippet: string | null;
  isRead: boolean;
  isStarred: boolean;
  isSnoozed: boolean;
  snoozeUntil: Date | null;
  receivedAt: Date | null;
  sentAt: Date | null;
  attachmentCount: number;
  labels: LabelInfo[];
}

// ─── Full Message (for message detail view) ───────────────────────────────────

export interface FullMessage extends MessageListItem {
  toAddresses: EmailAddress[];
  ccAddresses: EmailAddress[];
  bccAddresses: EmailAddress[];
  bodyHtml: string | null;
  bodyText: string | null;
  attachments: AttachmentInfo[];
  headers: Record<string, string>;
  size: number;
  mailAccountId: string;
  rawPath: string | null;
}

// ─── Thread ───────────────────────────────────────────────────────────────────

export interface ThreadSummary {
  id: string;
  subject: string;
  participantEmails: string[];
  messageCount: number;
  unreadCount: number;
  lastMessageAt: Date;
  labelIds: string[];
  messages: MessageListItem[];
}

// ─── Attachment Info ──────────────────────────────────────────────────────────

export interface AttachmentInfo {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  isInline: boolean;
  contentId?: string;
  /** Signed URL valid for a limited time */
  url?: string;
}

// ─── Label Info ───────────────────────────────────────────────────────────────

export interface LabelInfo {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  type: string;
  isSystem: boolean;
}

// ─── Mailbox Info (from IMAP) ─────────────────────────────────────────────────

export interface MailboxInfo {
  path: string;
  name: string;
  delimiter: string;
  flags: string[];
  specialUse?: string;
  listed: boolean;
  subscribed?: boolean;
}

// ─── Sync Result ──────────────────────────────────────────────────────────────

export interface SyncResult {
  mailAccountId: string;
  messagesAdded: number;
  messagesUpdated: number;
  errors: string[];
  syncedAt: Date;
  mailboxErrors?: number;
}

// ─── Send Options ─────────────────────────────────────────────────────────────

export interface SendOptions {
  mailAccountId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  attachments?: SendAttachment[];
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
}

export interface SendAttachment {
  filename: string;
  content: Buffer | string;
  mimeType: string;
  contentId?: string;
  isInline?: boolean;
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export type FilterConditionField =
  | "from"
  | "to"
  | "subject"
  | "body"
  | "hasAttachment"
  | "size";

export type FilterConditionOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan"
  | "is"
  | "isNot";

export interface FilterCondition {
  field: FilterConditionField;
  operator: FilterConditionOperator;
  value: string | number | boolean;
}

export type FilterActionType =
  | "addLabel"
  | "removeLabel"
  | "markRead"
  | "markUnread"
  | "star"
  | "unstar"
  | "archive"
  | "delete"
  | "moveToSpam"
  | "forwardTo";

export interface FilterAction {
  type: FilterActionType;
  value?: string; // labelId for addLabel/removeLabel, email for forwardTo
}

// ─── Notification Payload ────────────────────────────────────────────────────

export interface NotificationPayload {
  messageId?: string;
  threadId?: string;
  subject?: string;
  from?: string;
  preview?: string;
  [key: string]: unknown;
}

// ─── User Preferences ────────────────────────────────────────────────────────

export interface UserPreferences {
  themeMode?: "light" | "dark" | "system";
  primaryColor?: string;
  accentColor?: string;
  density?: "compact" | "comfortable" | "spacious";
  mailListLayout?: "default" | "preview" | "minimal" | "cards";
  animationsEnabled?: boolean;
  defaultAccountId?: string;
  replyAll?: boolean;
  notificationsEnabled?: boolean;
  soundEnabled?: boolean;
}
