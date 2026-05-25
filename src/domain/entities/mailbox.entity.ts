/**
 * MailForge — Mailbox Domain Entity
 *
 * Pure domain entity representing an IMAP mailbox/folder.
 */

export class MailboxEntity {
  readonly path: string;
  readonly name: string;
  readonly delimiter: string;
  readonly flags: string[];
  readonly specialUse?: string;
  readonly listed: boolean;
  readonly subscribed?: boolean;

  constructor(params: {
    path: string;
    name: string;
    delimiter: string;
    flags: string[];
    specialUse?: string;
    listed: boolean;
    subscribed?: boolean;
  }) {
    this.path = params.path;
    this.name = params.name;
    this.delimiter = params.delimiter;
    this.flags = params.flags;
    this.specialUse = params.specialUse;
    this.listed = params.listed;
    this.subscribed = params.subscribed;
  }

  // ─── Business Logic ───────────────────────────────────────────────────────

  isInbox(): boolean {
    return (
      this.specialUse === "\\Inbox" ||
      this.path.toUpperCase() === "INBOX"
    );
  }

  isSent(): boolean {
    return (
      this.specialUse === "\\Sent" ||
      /sent/i.test(this.name)
    );
  }

  isTrash(): boolean {
    return (
      this.specialUse === "\\Trash" ||
      /trash/i.test(this.name)
    );
  }

  isSpam(): boolean {
    return (
      this.specialUse === "\\Junk" ||
      this.specialUse === "\\Spam" ||
      /junk|spam/i.test(this.name)
    );
  }

  isDrafts(): boolean {
    return (
      this.specialUse === "\\Drafts" ||
      /draft/i.test(this.name)
    );
  }

  isArchive(): boolean {
    return (
      this.specialUse === "\\Archive" ||
      /archive/i.test(this.name)
    );
  }

  /**
   * Returns the system label type for this mailbox, or null for custom folders.
   */
  getSystemLabelType():
    | "INBOX"
    | "SENT"
    | "DRAFTS"
    | "TRASH"
    | "SPAM"
    | "ARCHIVE"
    | null {
    if (this.isInbox()) return "INBOX";
    if (this.isSent()) return "SENT";
    if (this.isDrafts()) return "DRAFTS";
    if (this.isTrash()) return "TRASH";
    if (this.isSpam()) return "SPAM";
    if (this.isArchive()) return "ARCHIVE";
    return null;
  }

  /**
   * Returns whether this is a system mailbox (not a custom folder).
   */
  isSystem(): boolean {
    return this.getSystemLabelType() !== null;
  }
}
