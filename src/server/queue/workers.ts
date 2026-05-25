/**
 * MailForge — BullMQ Workers
 *
 * Defines background workers for:
 * - Mail sync (IMAP → database)
 * - Mail send (database draft → SMTP)
 * - Notifications
 */

import { Worker } from "bullmq";
import { db } from "~/server/db";
import { SyncService } from "~/server/mail/sync";
import { createSmtpService } from "~/server/mail/smtp";
import { config } from "~/config";
import {
  getRedisConnection,
  type MailSyncJobData,
  type MailSendJobData,
  type NotificationJobData,
} from "./client";
import type { EmailAddress, SendOptions } from "~/types/mail";

// ─── Mail Sync Worker ─────────────────────────────────────────────────────────

export function createMailSyncWorker(): Worker<MailSyncJobData> {
  const worker = new Worker<MailSyncJobData>(
    "mail:sync",
    async (job) => {
      const { mailAccountId } = job.data;
      console.info(`[Worker:sync] Starting sync for account ${mailAccountId}`);

      const result = await SyncService.syncAccount(mailAccountId);

      if (result.errors.length > 0) {
        console.warn(
          `[Worker:sync] Sync completed with ${result.errors.length} errors:`,
          result.errors,
        );
      }

      console.info(
        `[Worker:sync] Sync complete: +${result.messagesAdded} new, ${result.messagesUpdated} updated`,
      );

      return result;
    },
    {
      connection: getRedisConnection(),
      concurrency: config.advanced.maxConcurrentImap,
      limiter: {
        max: config.advanced.maxConcurrentImap,
        duration: 1000,
      },
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[Worker:sync] Job ${job?.id ?? "unknown"} failed:`, err);
  });

  return worker;
}

// ─── Mail Send Worker ─────────────────────────────────────────────────────────

export function createMailSendWorker(): Worker<MailSendJobData> {
  const worker = new Worker<MailSendJobData>(
    "mail:send",
    async (job) => {
      const { draftId, mailAccountId } = job.data;
      console.info(`[Worker:send] Sending draft ${draftId}`);

      const [draft, account] = await Promise.all([
        db.draft.findUnique({ where: { id: draftId } }),
        db.mailAccount.findUnique({ where: { id: mailAccountId } }),
      ]);

      if (!draft) throw new Error(`Draft ${draftId} not found`);
      if (!account) throw new Error(`Mail account ${mailAccountId} not found`);

      const smtp = createSmtpService(account);

      const to = (draft.to as unknown as EmailAddress[]) ?? [];
      const cc = (draft.cc as unknown as EmailAddress[]) ?? [];
      const bcc = (draft.bcc as unknown as EmailAddress[]) ?? [];

      const sendOptions: SendOptions = {
        mailAccountId: account.id,
        from: {
          email: account.email,
          name: account.displayName ?? account.email,
        },
        to,
        cc,
        bcc,
        subject: draft.subject ?? "(no subject)",
        bodyHtml: draft.bodyHtml ?? "",
        inReplyTo: draft.inReplyTo ?? undefined,
        references: draft.references ?? undefined,
      };

      const info = await smtp.sendEmail(sendOptions);
      console.info(`[Worker:send] Message sent, ID: ${String(info.messageId)}`);

      // Delete the draft after successful send
      await db.draft.delete({ where: { id: draftId } });

      return { messageId: info.messageId };
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[Worker:send] Job ${job?.id ?? "unknown"} failed:`, err);
  });

  return worker;
}

// ─── Notification Worker ──────────────────────────────────────────────────────

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    "notifications",
    async (job) => {
      const { userId, type, payload } = job.data;
      console.info(`[Worker:notify] Processing ${type} notification for user ${userId}`);

      // Log notification to DB
      await db.notificationLog.create({
        data: {
          userId,
          type,
          isRead: false,
          // Cast payload to Prisma-compatible JSON input
          payload: payload as Parameters<typeof db.notificationLog.create>[0]["data"]["payload"],
        },
      });

      // TODO: Implement browser push and email digest sending
      // For now, we just record the notification in the database
      // Browser push: use Web Push API with stored subscription
      // Email digest: use nodemailer to send a digest email

      return { logged: true };
    },
    {
      connection: getRedisConnection(),
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[Worker:notify] Job ${job?.id ?? "unknown"} failed:`, err);
  });

  return worker;
}
