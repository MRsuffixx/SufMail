/**
 * MailForge — Queue Scheduler
 *
 * Sets up repeatable BullMQ jobs for periodic mail sync.
 * Sync interval is controlled by config.mail.syncIntervalSeconds.
 */

import { mailSyncQueue } from "./client";
import { db } from "~/server/db";
import { config } from "~/config";

/**
 * Removes all existing repeatable sync jobs for the given account ID.
 */
async function removeRepeatableSyncJobs(accountId: string): Promise<void> {
  const existing = await mailSyncQueue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name === "sync" && job.key.includes(accountId)) {
      await mailSyncQueue.removeRepeatableByKey(job.key);
    }
  }
}

/**
 * Schedules periodic sync jobs for all active mail accounts.
 * Runs once at startup, then repeats per config.mail.syncIntervalSeconds.
 * Deduplicates by removing existing repeatable jobs first.
 */
export async function schedulePeriodicSync(): Promise<void> {
  const intervalMs = config.mail.syncIntervalSeconds * 1000;
  console.info(
    `[Scheduler] Setting up periodic sync every ${config.mail.syncIntervalSeconds}s`,
  );

  const accounts = await db.mailAccount.findMany({
    where: { isActive: true },
    select: { id: true, userId: true, email: true },
  });

  console.info(`[Scheduler] Scheduling sync for ${accounts.length} accounts`);

  const allRepeatableJobs = await mailSyncQueue.getRepeatableJobs();
  for (const job of allRepeatableJobs) {
    if (job.name === "sync") {
      try {
        await mailSyncQueue.removeRepeatableByKey(job.key);
      } catch {
        // Job may already be removed by concurrent call
.
      }
    }
  }

  for (const account of accounts) {
    await mailSyncQueue.add(
      "sync",
      {
        mailAccountId: account.id,
        userId: account.userId,
        force: false,
      },
      {
        repeat: { every: intervalMs },
      },
    );

    console.info(`[Scheduler] Scheduled sync for ${account.email}`);
  }
}

/**
 * Adds or updates a repeatable sync job for a specific account.
 * Called when a new mail account is added or credentials are updated.
 */
export async function scheduleAccountSync(
  accountId: string,
  userId: string,
): Promise<void> {
  const intervalMs = config.mail.syncIntervalSeconds * 1000;

  await removeRepeatableSyncJobs(accountId);

  await mailSyncQueue.add(
    "sync",
    {
      mailAccountId: accountId,
      userId,
      force: false,
    },
    {
      repeat: { every: intervalMs },
    },
  );
}

/**
 * Removes the repeatable sync job for an account.
 * Called when a mail account is deleted or deactivated.
 */
export async function unscheduleAccountSync(accountId: string): Promise<void> {
  await removeRepeatableSyncJobs(accountId);
}

/**
 * Schedules snooze wakeup jobs by querying for messages whose snooze time
 * has passed. Should be called periodically (e.g., every minute).
 */
export async function processSnoozeWakeups(): Promise<void> {
  const now = new Date();

  const snoozed = await db.snoozedMessage.findMany({
    where: { snoozeUntil: { lte: now } },
    include: { message: true },
  });

  for (const snoozedMsg of snoozed) {
    await db.$transaction([
      db.message.update({
        where: { id: snoozedMsg.messageId },
        data: { isSnoozed: false, snoozeUntil: null },
      }),
      db.snoozedMessage.delete({ where: { id: snoozedMsg.id } }),
    ]);

    const { enqueueNotification } = await import("./client");
    await enqueueNotification({
      userId: snoozedMsg.userId,
      type: "snooze_wakeup",
      payload: {
        messageId: snoozedMsg.messageId,
        subject: snoozedMsg.message.subject ?? "(no subject)",
      },
    });
  }
}
