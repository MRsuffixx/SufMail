/**
 * MailForge — BullMQ Queue Client
 *
 * Initializes BullMQ Queue instances for async job processing.
 * All queues connect to Redis via ioredis.
 */

import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "~/env";

// ─── Redis Connection ─────────────────────────────────────────────────────────

let _redisConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (_redisConnection) return _redisConnection;

  const redisUrl = env.REDIS_URL ?? "redis://localhost:6379";

  _redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  _redisConnection.on("error", (err: Error) => {
    console.error("[Redis] Connection error:", err.message);
  });

  _redisConnection.on("connect", () => {
    console.info("[Redis] Connected");
  });

  return _redisConnection;
}

// ─── Job Data Types ───────────────────────────────────────────────────────────

export interface MailSyncJobData {
  mailAccountId: string;
  userId: string;
  /** Force full sync even if recently synced */
  force?: boolean;
}

export interface MailSendJobData {
  draftId: string;
  userId: string;
  mailAccountId: string;
  /** ISO string of when to send (null = immediately) */
  scheduledAt: string | null;
}

export interface NotificationJobData {
  userId: string;
  type: "new_message" | "digest" | "snooze_wakeup";
  payload: Record<string, unknown>;
}

// ─── Queue Instances ──────────────────────────────────────────────────────────

const QUEUE_OPTIONS = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 5000,
    },
  },
};

export const mailSyncQueue = new Queue<MailSyncJobData>(
  "mail:sync",
  QUEUE_OPTIONS,
);

export const mailSendQueue = new Queue<MailSendJobData>(
  "mail:send",
  QUEUE_OPTIONS,
);

export const notificationQueue = new Queue<NotificationJobData>(
  "notifications",
  {
    ...QUEUE_OPTIONS,
    defaultJobOptions: {
      ...QUEUE_OPTIONS.defaultJobOptions,
      attempts: 2,
    },
  },
);

// ─── Queue Helpers ────────────────────────────────────────────────────────────

/**
 * Enqueues a mail sync job for a specific account.
 */
export async function enqueueSyncJob(
  data: MailSyncJobData,
  opts?: { delay?: number; priority?: number },
): Promise<void> {
  await mailSyncQueue.add("sync", data, {
    delay: opts?.delay,
    priority: opts?.priority,
    jobId: `sync:${data.mailAccountId}`, // Deduplication
  });
}

/**
 * Enqueues a mail send job (optionally scheduled).
 */
export async function enqueueSendJob(
  data: MailSendJobData,
  delay?: number,
): Promise<void> {
  await mailSendQueue.add("send", data, {
    delay,
    jobId: `send:${data.draftId}`,
  });
}

/**
 * Enqueues a notification job.
 */
export async function enqueueNotification(
  data: NotificationJobData,
): Promise<void> {
  await notificationQueue.add("notify", data);
}
