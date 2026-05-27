/**
 * MailForge — IMAP Connection Manager
 *
 * Module-level singleton that manages one persistent ImapIdleService
 * per active MailAccount. Started once in worker.ts on boot.
 */

import { db } from "~/server/db";
import { ImapIdleService } from "./imap-idle.service";
import { logger } from "~/lib/logger";

class ImapConnectionManagerClass {
  private readonly connections = new Map<string, ImapIdleService>();

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Starts IDLE connections for all active mail accounts.
   */
  async startAll(): Promise<void> {
    const accounts = await db.mailAccount.findMany({
      where: { isActive: true },
    });

    logger.info(
      { count: accounts.length },
      "[ConnectionManager] Starting IDLE connections",
    );

    for (const account of accounts) {
      this.start(account);
    }
  }

  /**
   * Starts an IDLE connection for a single account.
   */
  start(account: import("../../../generated/prisma").MailAccount): void {
    if (this.connections.has(account.id)) return;
    try {
      const service = new ImapIdleService(account);
      service.start();
      this.connections.set(account.id, service);
      logger.info(
        { accountId: account.id, email: account.email },
        "[ConnectionManager] Started IDLE connection",
      );
    } catch (err) {
      logger.error(
        { accountId: account.id, err },
        "[ConnectionManager] Failed to start IDLE",
      );
    }
  }

  /**
   * Stops and removes the IDLE connection for an account.
   */
  async stop(accountId: string): Promise<void> {
    const service = this.connections.get(accountId);
    if (!service) return;
    await service.stop();
    this.connections.delete(accountId);
    logger.info({ accountId }, "[ConnectionManager] Stopped IDLE connection");
  }

  /**
   * Stops all connections. Called on process shutdown.
   */
  async stopAll(): Promise<void> {
    logger.info("[ConnectionManager] Stopping all IDLE connections");
    const stops = Array.from(this.connections.keys()).map((id) =>
      this.stop(id),
    );
    await Promise.allSettled(stops);
  }

  /**
   * Returns the number of active connections.
   */
  get activeCount(): number {
    return this.connections.size;
  }

  /**
   * Returns list of connected account IDs.
   */
  get connectedAccountIds(): string[] {
    return Array.from(this.connections.keys());
  }
}

// Module-level singleton
export const ImapConnectionManager = new ImapConnectionManagerClass();
