/**
 * MailForge — SMTP Service
 *
 * Handles sending email via nodemailer.
 * Credentials are decrypted from the stored MailAccount.
 */

import nodemailer, { type Transporter, type SentMessageInfo } from "nodemailer";
import type { MailAccount } from "../../../generated/prisma";
import type { SendOptions } from "~/types/mail";
import { decryptObject } from "~/lib/crypto";
import { formatEmailAddress } from "~/lib/mail-utils";

// ─── Credential Types ─────────────────────────────────────────────────────────

interface StoredCredentials {
  imapPassword: string;
  smtpPassword: string;
}

// ─── Transporter Pool ─────────────────────────────────────────────────────────

const transporterPool = new Map<string, Transporter>();

function getTransporter(account: MailAccount): Transporter {
  const existing = transporterPool.get(account.id);
  if (existing) return existing;

  let smtpPassword: string;
  try {
    const creds = decryptObject<StoredCredentials>(account.credentials);
    smtpPassword = creds.smtpPassword;
  } catch {
    throw new Error(
      `Failed to decrypt SMTP credentials for account ${account.email}`,
    );
  }

  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: {
      user: account.email,
      pass: smtpPassword,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  transporterPool.set(account.id, transporter);
  return transporter;
}

/**
 * Evicts a transporter from the pool (e.g. when account credentials change).
 */
export function evictTransporter(accountId: string): void {
  transporterPool.delete(accountId);
}

// ─── SMTP Service ─────────────────────────────────────────────────────────────

export class SmtpService {
  private readonly account: MailAccount;
  private readonly transporter: Transporter;

  constructor(account: MailAccount) {
    this.account = account;
    this.transporter = getTransporter(account);
  }

  /**
   * Verifies the SMTP connection is working.
   * Returns true on success, throws on failure.
   */
  async verifyConnection(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Sends an email using the account's SMTP configuration.
   *
   * @param options - Send options including recipients, subject, body, attachments
   * @returns The sent message info including the Message-ID
   */
  async sendEmail(options: SendOptions): Promise<SentMessageInfo> {
    const {
      from,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
      bodyText,
      attachments,
      inReplyTo,
      references,
      headers,
    } = options;

    const mailOptions: Parameters<typeof this.transporter.sendMail>[0] = {
      from: formatEmailAddress(from),
      to: to.map(formatEmailAddress).join(", "),
      cc: cc?.map(formatEmailAddress).join(", "),
      bcc: bcc?.map(formatEmailAddress).join(", "),
      subject,
      html: bodyHtml,
      text: bodyText,
      inReplyTo,
      references,
      headers: headers ?? {},
      attachments: attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.mimeType,
        cid: att.contentId,
        disposition: att.isInline ? "inline" : "attachment",
      })),
    };

    const info = await this.transporter.sendMail(mailOptions);
    return info;
  }
}

/**
 * Factory function for creating SmtpService instances.
 */
export function createSmtpService(account: MailAccount): SmtpService {
  return new SmtpService(account);
}
