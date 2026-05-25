/**
 * MailForge — BullMQ Worker Entry Point
 *
 * Run this process separately from the Next.js app to handle background jobs.
 *
 * Usage:
 *   pnpm worker:start   — production
 *   pnpm worker:dev     — development (with tsx watch)
 */

import { createMailSyncWorker, createMailSendWorker, createNotificationWorker } from "~/server/queue/workers";
import { schedulePeriodicSync } from "~/server/queue/scheduler";
import { getRedisConnection } from "~/server/queue/client";

async function main() {
  console.info("╔═══════════════════════════════════════╗");
  console.info("║   MailForge Worker Process Starting   ║");
  console.info("╚═══════════════════════════════════════╝");

  // Test Redis connection
  const redis = getRedisConnection();
  try {
    await redis.ping();
    console.info("[Worker] ✓ Redis connected");
  } catch (err) {
    console.error("[Worker] ✗ Redis connection failed:", err);
    process.exit(1);
  }

  // Start all workers
  const syncWorker = createMailSyncWorker();
  const sendWorker = createMailSendWorker();
  const notifWorker = createNotificationWorker();

  console.info("[Worker] ✓ Mail sync worker started");
  console.info("[Worker] ✓ Mail send worker started");
  console.info("[Worker] ✓ Notification worker started");

  // Schedule periodic sync for all active accounts
  try {
    await schedulePeriodicSync();
    console.info("[Worker] ✓ Periodic sync scheduled");
  } catch (err) {
    console.error("[Worker] ✗ Failed to schedule periodic sync:", err);
  }

  console.info("[Worker] 🚀 All workers running. Press Ctrl+C to stop.\n");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.info(`\n[Worker] Received ${signal}, shutting down gracefully...`);

    await Promise.all([
      syncWorker.close(),
      sendWorker.close(),
      notifWorker.close(),
    ]);

    await redis.quit();
    console.info("[Worker] Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
