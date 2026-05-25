/**
 * MailForge — IMAP Service
 *
 * Manages IMAP connections and mail fetching using imapflow.
 * Supports connection pooling, automatic reconnection, and batch operations.
 */

import { ImapFlow, type ImapFlowOptions, type FetchMessageObject } from "imapflow";
import type { MailAccount } from "../../../generated/prisma";
import type { MailboxInfo, ParsedEmail } from "~/types/mail";
import { parseRawEmail } from "./parser";
import { decryptObject } from "~/lib/crypto";

// ─── Credential Types ─────────────────────────────────────────────────────────

interface StoredCredentials {
  imapPassword: string;
  smtpPassword: string;
}

// ─── IMAP Service ─────────────────────────────────────────────────────────────

export class ImapService {
  private client: ImapFlow | null = null;
  private readonly account: MailAccount;
  private readonly password: string;
  private isConnected = false;

  constructor(account: MailAccount) {
    this.account = account;

    try {
      const creds = decryptObject<StoredCredentials>(account.credentials);
      this.password = creds.imapPassword;
    } catch {
      throw new Error(
        `Failed to decrypt credentials for account ${account.email}`,
      );
    }
  }

  // ─── Connection Management ───────────────────────────────────────────────

  /**
   * Connects to the IMAP server.
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) return;

    const options: ImapFlowOptions = {
      host: this.account.imapHost,
      port: this.account.imapPort,
      secure: this.account.imapTls,
      auth: {
        user: this.account.email,
        pass: this.password,
      },
      logger: false,
      tls: {
        rejectUnauthorized: true,
      },
    };

    this.client = new ImapFlow(options);

    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (err) {
      this.client = null;
      this.isConnected = false;
      throw new Error(
        `IMAP connection failed for ${this.account.email}: ${String(err)}`,
      );
    }
  }

  /**
   * Disconnects from the IMAP server gracefully.
   */
  async disconnect(): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.logout();
    } finally {
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Ensures connection is active, reconnecting if necessary.
   */
  private async ensureConnected(): Promise<ImapFlow> {
    if (!this.isConnected || !this.client) {
      await this.connect();
    }
    if (!this.client) throw new Error("IMAP client not initialized");
    return this.client;
  }

  // ─── Mailbox Operations ───────────────────────────────────────────────────

  /**
   * Lists all mailboxes (folders) available on the IMAP server.
   */
  async getMailboxes(): Promise<MailboxInfo[]> {
    const client = await this.ensureConnected();
    const list = await client.list();

    return list.map((mb) => ({
      path: mb.path,
      name: mb.name,
      delimiter: mb.delimiter ?? "/",
      flags: Array.from(mb.flags ?? []),
      specialUse: mb.specialUse ?? undefined,
      listed: mb.listed,
      subscribed: mb.subscribed,
    }));
  }

  // ─── Message Fetching ─────────────────────────────────────────────────────

  /**
   * Fetches messages from a mailbox since a given date.
   *
   * @param mailbox - Mailbox name (e.g. "INBOX")
   * @param since - Fetch messages received after this date
   * @param limit - Maximum number of messages to fetch
   * @returns Array of parsed email objects
   */
  async fetchMessages(
    mailbox = "INBOX",
    since?: Date,
    limit = 50,
  ): Promise<ParsedEmail[]> {
    const client = await this.ensureConnected();
    const results: ParsedEmail[] = [];

    await client.mailboxOpen(mailbox, { readOnly: true });

    const searchCriteria = since ? { since } : { all: true as const };

    const uids: number[] = [];
    for await (const msg of client.fetch(searchCriteria, { uid: true })) {
      uids.push(msg.uid);
      if (uids.length >= limit) break;
    }

    if (uids.length === 0) return results;

    // Fetch in batches of 10 to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < uids.length; i += batchSize) {
      const batch = uids.slice(i, i + batchSize);
      // SequenceString format: "1,2,3" or "1:10"
      const uidSet = batch.join(",");

      for await (const msg of client.fetch(
        uidSet,
        { uid: true, source: true, flags: true, envelope: true },
        { uid: true },
      )) {
        try {
          if (msg.source) {
            const parsed = await parseRawEmail(msg.source, msg.uid, mailbox);
            results.push(parsed);
          }
        } catch (err) {
          console.error(`[IMAP] Failed to parse message UID ${msg.uid}:`, err);
        }
      }
    }

    return results;
  }

  /**
   * Fetches a single message by UID with full body.
   *
   * @param uid - IMAP UID of the message
   * @param mailbox - Mailbox containing the message
   */
  async fetchMessage(uid: number, mailbox = "INBOX"): Promise<ParsedEmail | null> {
    const client = await this.ensureConnected();

    await client.mailboxOpen(mailbox, { readOnly: true });

    let rawMsg: FetchMessageObject | null = null;
    for await (const msg of client.fetch(
      String(uid),
      { uid: true, source: true, flags: true },
      { uid: true },
    )) {
      rawMsg = msg;
      break;
    }

    if (!rawMsg?.source) return null;

    return parseRawEmail(rawMsg.source, rawMsg.uid, mailbox);
  }

  // ─── Flag Operations ──────────────────────────────────────────────────────

  /**
   * Marks messages as read (\\Seen flag).
   */
  async markRead(uids: number[], mailbox = "INBOX"): Promise<void> {
    const client = await this.ensureConnected();
    await client.mailboxOpen(mailbox);
    await client.messageFlagsAdd(uids.join(","), ["\\Seen"], { uid: true });
  }

  /**
   * Marks messages as unread (removes \\Seen flag).
   */
  async markUnread(uids: number[], mailbox = "INBOX"): Promise<void> {
    const client = await this.ensureConnected();
    await client.mailboxOpen(mailbox);
    await client.messageFlagsRemove(uids.join(","), ["\\Seen"], { uid: true });
  }

  /**
   * Marks messages with \\Flagged (starred).
   */
  async markFlagged(uids: number[], mailbox = "INBOX"): Promise<void> {
    const client = await this.ensureConnected();
    await client.mailboxOpen(mailbox);
    await client.messageFlagsAdd(uids.join(","), ["\\Flagged"], { uid: true });
  }

  /**
   * Removes \\Flagged from messages.
   */
  async unmarkFlagged(uids: number[], mailbox = "INBOX"): Promise<void> {
    const client = await this.ensureConnected();
    await client.mailboxOpen(mailbox);
    await client.messageFlagsRemove(uids.join(","), ["\\Flagged"], { uid: true });
  }

  // ─── Move / Delete ────────────────────────────────────────────────────────

  /**
   * Moves messages to a target mailbox.
   */
  async moveMessage(
    uids: number[],
    targetMailbox: string,
    sourceMailbox = "INBOX",
  ): Promise<void> {
    const client = await this.ensureConnected();
    await client.mailboxOpen(sourceMailbox);
    await client.messageMove(uids.join(","), targetMailbox, { uid: true });
  }

  /**
   * Deletes messages by moving them to the Trash mailbox.
   * Falls back to adding \\Deleted flag + expunge if no Trash folder.
   */
  async deleteMessage(uids: number[], mailbox = "INBOX"): Promise<void> {
    const client = await this.ensureConnected();
    const mailboxes = await this.getMailboxes();
    const trashMailbox = mailboxes.find(
      (mb) => mb.specialUse === "\\Trash" || /trash/i.test(mb.name),
    );

    if (trashMailbox) {
      await this.moveMessage(uids, trashMailbox.path, mailbox);
    } else {
      await client.mailboxOpen(mailbox);
      await client.messageFlagsAdd(uids.join(","), ["\\Deleted"], { uid: true });
      await client.messageDelete(uids.join(","), { uid: true });
    }
  }

  // ─── Connection Test ──────────────────────────────────────────────────────

  /**
   * Tests the IMAP connection and returns basic server info.
   * Used when adding a new mail account.
   */
  async testConnection(): Promise<{
    success: boolean;
    error?: string;
    capabilities?: string[];
  }> {
    try {
      await this.connect();
      const client = this.client!;
      const caps = client.capabilities;
      const capabilities = caps ? Array.from(caps.keys()) : [];
      await this.disconnect();
      return { success: true, capabilities };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ─── Connection Pool ──────────────────────────────────────────────────────────

const pool = new Map<string, ImapService>();

/**
 * Gets or creates an ImapService instance from the connection pool.
 */
export function getImapService(account: MailAccount): ImapService {
  const existing = pool.get(account.id);
  if (existing) return existing;

  const service = new ImapService(account);
  pool.set(account.id, service);
  return service;
}

/**
 * Removes an ImapService from the pool and disconnects it.
 */
export async function releaseImapService(accountId: string): Promise<void> {
  const service = pool.get(accountId);
  if (service) {
    await service.disconnect();
    pool.delete(accountId);
  }
}
