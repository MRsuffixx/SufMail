/**
 * MailForge — BullMQ Worker Entry Point
 *
 * Run this process separately from the Next.js app to handle background jobs.
 *
 * Usage:
 *   pnpm worker:start   — production
 *   pnpm worker:dev     — development (with tsx watch)
 */

// OpenTelemetry must be initialized before any other imports
import { initTracing, shutdownTracing } from "~/server/observability/tracing";
initTracing();

import { createMailSyncWorker, createMailSendWorker, createNotificationWorker } from "~/server/queue/workers";
import { schedulePeriodicSync } from "~/server/queue/scheduler";
import { getRedisConnection } from "~/server/queue/client";
import { ImapConnectionManager } from "~/server/mail/connection-manager";
import { logger } from "~/lib/logger";

async function main() {
  logger.info("╔═══════════════════════════════════════╗");
  logger.info("║   MailForge Worker Process Starting   ║");
  logger.info("╚═══════════════════════════════════════╝");

  // Test Redis connection
  const redis = getRedisConnection();
  try {
    await redis.ping();
    logger.info("[Worker] ✓ Redis connected");
  } catch (err) {
    logger.error({ err }, "[Worker] ✗ Redis connection failed");
    process.exit(1);
  }

  // Start all BullMQ workers
  const syncWorker = createMailSyncWorker();
  const sendWorker = createMailSendWorker();
  const notifWorker = createNotificationWorker();

  logger.info("[Worker] ✓ Mail sync worker started");
  logger.info("[Worker] ✓ Mail send worker started");
  logger.info("[Worker] ✓ Notification worker started");

  // Schedule periodic sync for all active accounts
  try {
    await schedulePeriodicSync();
    logger.info("[Worker] ✓ Periodic sync scheduled");
  } catch (err) {
    logger.error({ err }, "[Worker] ✗ Failed to schedule periodic sync");
  }

  // Start IMAP IDLE persistent connection manager
  try {
    await ImapConnectionManager.startAll();
    logger.info(
      { connections: ImapConnectionManager.activeCount },
      "[Worker] ✓ IMAP IDLE connections started",
    );
  } catch (err) {
    logger.error({ err }, "[Worker] ✗ Failed to start IMAP connections");
  }

  logger.info("[Worker] 🚀 All workers running. Press Ctrl+C to stop.\n");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`[Worker] Received ${signal}, shutting down gracefully...`);

    // Stop IDLE connections first
    await ImapConnectionManager.stopAll();

    await Promise.all([
      syncWorker.close(),
      sendWorker.close(),
      notifWorker.close(),
    ]);

    await redis.quit();
    await shutdownTracing();

    logger.info("[Worker] Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "[Worker] Uncaught exception");
  });
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "[Worker] Unhandled rejection");
  });
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
