/**
 * MailForge — BullMQ Workers
 *
 * Defines background workers for:
 * - Mail sync (IMAP → database)
 * - Mail send (database draft → SMTP)
 * - Notifications (email delivery + browser push scaffold)
 */

import { Worker } from "bullmq";
import nodemailer from "nodemailer";
import { db } from "~/server/db";
import { SyncService } from "~/server/mail/sync";
import { createSmtpService } from "~/server/mail/smtp";
import { config } from "~/config";
import { env } from "~/env";
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

      const to = (Array.isArray(draft.to) ? draft.to : []) as EmailAddress[];
      const cc = (Array.isArray(draft.cc) ? draft.cc : []) as EmailAddress[];
      const bcc = (Array.isArray(draft.bcc) ? draft.bcc : []) as EmailAddress[];

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
      try {
        await db.draft.delete({ where: { id: draftId } });
      } catch (deleteErr) {
        console.error(`[Worker:send] Failed to delete draft ${draftId}:`, deleteErr);
      }

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

/**
 * Builds a system nodemailer transporter from EMAIL_SERVER_* env vars.
 * Returns null if the system email server is not configured.
 */
function getSystemTransporter(): nodemailer.Transporter | null {
  if (!env.EMAIL_SERVER_HOST || !env.EMAIL_FROM) return null;

  return nodemailer.createTransport({
    host: env.EMAIL_SERVER_HOST,
    port: env.EMAIL_SERVER_PORT ?? 587,
    auth:
      env.EMAIL_SERVER_USER && env.EMAIL_SERVER_PASSWORD
        ? { user: env.EMAIL_SERVER_USER, pass: env.EMAIL_SERVER_PASSWORD }
        : undefined,
  });
}

/**
 * Escapes HTML special characters to prevent XSS in notification email content.
 */
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Builds an HTML email body for a notification.
 */
function buildNotificationEmail(
  type: NotificationJobData["type"],
  payload: Record<string, unknown>,
  appName: string,
): { subject: string; html: string; text: string } {
  const safeAppName = escapeHtml(appName);
  const subjectRaw = payload.subject != null ? String(payload.subject) : "(no subject)";
  const subject = `New message: ${escapeHtml(subjectRaw)}`;
  const from = escapeHtml(String(payload.fromEmail ?? ""));
  const preview = escapeHtml(String(payload.snippet ?? ""));
  switch (type) {
    case "new_message": {
      return {
        subject,
        html: `
          <p>You have a new message in <strong>${safeAppName}</strong>.</p>
          <p><strong>From:</strong> ${from}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subjectRaw)}</p>
          ${preview ? `<p><strong>Preview:</strong> ${preview}</p>` : ""}
          <hr/>
          <p style="color:#888;font-size:12px">
            You are receiving this because notifications are enabled in ${safeAppName}.
          </p>`,
        text: `New message from ${from}: ${subjectRaw}${preview ? `\n\n${preview}` : ""}`,
      };
    }
    case "snooze_wakeup": {
      const subjectStr = payload.subject != null ? String(payload.subject) : "(no subject)";
      return {
        subject: `Reminder: ${escapeHtml(subjectStr)}`,
        html: `
          <p>Your snoozed message has woken up in <strong>${safeAppName}</strong>.</p>
          <p><strong>Subject:</strong> ${escapeHtml(subjectStr)}</p>
          <hr/>
          <p style="color:#888;font-size:12px">
            You are receiving this because you snoozed a message in ${safeAppName}.
          </p>`,
        text: `Snoozed message reminder: ${subjectStr}`,
      };
    }
    case "digest": {
      const rawCount = payload.count;
      const count = typeof rawCount === "number" && !isNaN(rawCount) ? rawCount : 0;
      const subjectStr = `Your ${safeAppName} digest: ${count} new message${count !== 1 ? "s" : ""}`;
      return {
        subject: subjectStr,
        html: `
          <p>Here is your <strong>${safeAppName}</strong> digest.</p>
          <p>You have <strong>${count}</strong> new message${count !== 1 ? "s" : ""} since your last digest.</p>
          <hr/>
          <p style="color:#888;font-size:12px">
            You are receiving this digest because email digest is enabled in ${safeAppName}.
          </p>`,
        text: `${safeAppName} digest: ${count} new message${count !== 1 ? "s" : ""}.`,
      };
    }
    default: {
      return {
        subject: `${safeAppName} notification`,
        html: `<p>You have a new notification in <strong>${safeAppName}</strong>.</p>`,
        text: `You have a new notification in ${safeAppName}.`,
      };
    }
  }
}

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    "notifications",
    async (job) => {
      const { userId, type, payload } = job.data;
      console.info(
        `[Worker:notify] Processing ${type} notification for user ${userId}`,
      );

      // 1. Always persist to the notification log for in-app display.
      await db.notificationLog.create({
        data: {
          userId,
          type,
          isRead: false,
          payload:
            payload as Parameters<
              typeof db.notificationLog.create
            >[0]["data"]["payload"],
        },
      });

      // 2. Fetch user to check preferences and get their email address.
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          settings: true,
        },
      });

      if (!user?.email) {
        console.warn(
          `[Worker:notify] No email for user ${userId}; skipping email delivery`,
        );
        return { logged: true, emailed: false };
      }

      // Read notification preference from user settings (falls back to config default).
      const prefs = (user.settings ?? {}) as {
        notificationsEnabled?: boolean;
      };
      const notificationsEnabled =
        prefs.notificationsEnabled ?? config.notifications.browser;

      // 3. Email delivery via the system SMTP transport.
      //    Gated on: system transport configured + user has notifications enabled.
      //    For "digest" type, additionally gate on config.notifications.emailDigest.
      const shouldEmail =
        notificationsEnabled &&
        (type !== "digest" || config.notifications.emailDigest);

      if (shouldEmail) {
        const transporter = getSystemTransporter();
        if (transporter) {
          try {
            const { subject, html, text } = buildNotificationEmail(
              type,
              payload,
              config.app.name,
            );
            await transporter.sendMail({
              from: env.EMAIL_FROM,
              to: user.email,
              subject,
              html,
              text,
            });
            console.info(
              `[Worker:notify] Email delivered to ${user.email} (type=${type})`,
            );
          } catch (err) {
            // Non-fatal: log but don't fail the job — the DB entry is already created.
            console.error(
              `[Worker:notify] Failed to send email to ${user.email}:`,
              err,
            );
          }
        } else {
          console.warn(
            "[Worker:notify] EMAIL_SERVER_HOST not configured; skipping email delivery",
          );
        }
      }

      // 4. Browser push delivery.
      //    Requires a PushSubscription model in the database to store
      //    per-device VAPID subscriptions. Add the following to schema.prisma:
      //
      //    model PushSubscription {
      //      id        String @id @default(cuid())
      //      userId    String
      //      endpoint  String @unique
      //      keys      Json   // { p256dh: string, auth: string }
      //      createdAt DateTime @default(now())
      //      user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
      //    }
      //
      //    Then install `web-push`, generate VAPID keys, and implement:
      //
      //    const subscriptions = await db.pushSubscription.findMany({ where: { userId } });
      //    for (const sub of subscriptions) {
      //      await webpush.sendNotification(sub, JSON.stringify({ type, payload }));
      //    }
      //
      //    config.notifications.browser controls whether push is globally enabled.

      return { logged: true, emailed: shouldEmail };
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
