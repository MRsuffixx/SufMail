/**
 * MailForge — Queue Monitoring Service
 *
 * Provides health stats for all BullMQ queues and workers.
 * Exposed via the admin tRPC router.
 */

import { mailSyncQueue, mailSendQueue, notificationQueue } from "./client";

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface AllQueueStats {
  queues: QueueStats[];
  totalWaiting: number;
  totalActive: number;
  totalFailed: number;
  capturedAt: string;
}

export class QueueMonitoringService {
  /**
   * Returns counts for all queues.
   */
  static async getQueueStats(): Promise<AllQueueStats> {
    const [syncCounts, sendCounts, notifyCounts] = await Promise.all([
      mailSyncQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
      ),
      mailSendQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
      ),
      notificationQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
      ),
    ]);

    const toStats = (name: string, counts: Record<string, number>): QueueStats => ({
      name,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    });

    const queues = [
      toStats("mail:sync", syncCounts),
      toStats("mail:send", sendCounts),
      toStats("notifications", notifyCounts),
    ];

    return {
      queues,
      totalWaiting: queues.reduce((s, q) => s + q.waiting, 0),
      totalActive: queues.reduce((s, q) => s + q.active, 0),
      totalFailed: queues.reduce((s, q) => s + q.failed, 0),
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns failed jobs from all queues (for DLQ inspection).
   */
  static async getFailedJobs(limit = 20): Promise<
    Array<{
      queue: string;
      jobId: string;
      name: string;
      failedReason: string;
      attemptsMade: number;
      timestamp: number;
      data: unknown;
    }>
  > {
    const [syncFailed, sendFailed, notifyFailed] = await Promise.all([
      mailSyncQueue.getFailed(0, limit - 1),
      mailSendQueue.getFailed(0, limit - 1),
      notificationQueue.getFailed(0, limit - 1),
    ]);

    const toResult = (queue: string, jobs: typeof syncFailed) =>
      jobs.map((j) => ({
        queue,
        jobId: j.id ?? "",
        name: j.name,
        failedReason: j.failedReason ?? "unknown",
        attemptsMade: j.attemptsMade,
        timestamp: j.timestamp,
        data: j.data as unknown,
      }));

    return [
      ...toResult("mail:sync", syncFailed),
      ...toResult("mail:send", sendFailed),
      ...toResult("notifications", notifyFailed),
    ].slice(0, limit);
  }

  /**
   * Retries a failed job in the mail:sync queue.
   */
  static async retryJob(
    queueName: "mail:sync" | "mail:send" | "notifications",
    jobId: string,
  ): Promise<void> {
    const queue =
      queueName === "mail:sync"
        ? mailSyncQueue
        : queueName === "mail:send"
          ? mailSendQueue
          : notificationQueue;

    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in ${queueName}`);
    await job.retry();
  }

  /**
   * Discards (removes) a failed job permanently.
   */
  static async discardJob(
    queueName: "mail:sync" | "mail:send" | "notifications",
    jobId: string,
  ): Promise<void> {
    const queue =
      queueName === "mail:sync"
        ? mailSyncQueue
        : queueName === "mail:send"
          ? mailSendQueue
          : notificationQueue;

    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in ${queueName}`);
    await job.remove();
  }
}
