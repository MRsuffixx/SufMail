/**
 * MailForge — IMAP IDLE Service
 *
 * Maintains persistent IMAP connections with IDLE support for push-like
 * email notifications. Falls back to adaptive polling when IDLE is unavailable.
 * Includes exponential backoff reconnect logic and circuit breaker.
 */

import { ImapFlow, type ImapFlowOptions } from "imapflow";
import { enqueueSyncJob } from "~/server/queue/client";
import { decryptObject } from "~/lib/crypto";
import { logger } from "~/lib/logger";
import type { MailAccount } from "../../../generated/prisma";

interface StoredCredentials {
  imapPassword: string;
  smtpPassword: string;
}

// Circuit breaker thresholds
const MAX_CONSECUTIVE_FAILURES = 5;
const CIRCUIT_OPEN_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

export class ImapIdleService {
  private client: ImapFlow | null = null;
  private readonly account: MailAccount;
  private readonly password: string;
  private isRunning = false;
  private reconnectAttempts = 0;
  private consecutiveFailures = 0;
  private circuitOpenUntil: Date | null = null;
  private idleAbortController: AbortController | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private supportsIdle = true;

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

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Starts the IDLE/polling loop. Non-blocking.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    void this.runLoop();
  }

  /**
   * Stops the IDLE/polling loop and disconnects.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.idleAbortController?.abort();
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    await this.disconnect();
  }

  // ─── Main Loop ────────────────────────────────────────────────────────────

  private async runLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check circuit breaker
        if (this.circuitOpenUntil && new Date() < this.circuitOpenUntil) {
          const waitMs = this.circuitOpenUntil.getTime() - Date.now();
          logger.warn(
            { accountId: this.account.id, waitMs },
            "[IDLE] Circuit open, waiting before retry",
          );
          await sleep(waitMs);
          continue;
        }

        await this.connect();
        this.reconnectAttempts = 0;
        this.consecutiveFailures = 0;

        if (this.supportsIdle) {
          await this.runIdleLoop();
        } else {
          await this.runPollingLoop();
        }
      } catch (err) {
        if (!this.isRunning) break;

        this.consecutiveFailures++;
        logger.error(
          { accountId: this.account.id, err, consecutiveFailures: this.consecutiveFailures },
          "[IDLE] Connection error",
        );

        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.circuitOpenUntil = new Date(Date.now() + CIRCUIT_OPEN_MS);
          this.consecutiveFailures = 0;
          logger.warn(
            { accountId: this.account.id, until: this.circuitOpenUntil },
            "[IDLE] Circuit breaker opened",
          );
        }

        await this.disconnect();
        const delay = this.getReconnectDelay();
        this.reconnectAttempts++;
        await sleep(delay);
      }
    }
  }

  // ─── IDLE Loop ────────────────────────────────────────────────────────────

  private async runIdleLoop(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.mailboxOpen("INBOX");
    } catch {
      this.supportsIdle = false;
      return;
    }

    logger.info({ accountId: this.account.id }, "[IDLE] Starting IDLE mode");

    while (this.isRunning) {
      this.idleAbortController = new AbortController();

      try {
        // Listen for EXISTS (new message count) or EXPUNGE events
        const existsHandler = () => {
          this.idleAbortController?.abort();
          void this.triggerSync();
        };

        this.client!.on("exists", existsHandler);

        // Run IDLE — blocks until server sends update or we abort
        try {
          await this.client!.idle();
        } finally {
          this.client!.off("exists", existsHandler);
        }
      } catch (err) {
        // Abort is expected when we trigger a sync
        if ((err as Error).name === "AbortError") continue;
        throw err;
      }
    }
  }

  // ─── Polling Fallback ─────────────────────────────────────────────────────

  private async runPollingLoop(): Promise<void> {
    logger.info(
      { accountId: this.account.id },
      "[IDLE] IDLE not supported, using adaptive polling",
    );

    while (this.isRunning) {
      await this.triggerSync();
      // 30s polling when IDLE unavailable
      await sleep(30_000);
    }
  }

  // ─── Sync Trigger ─────────────────────────────────────────────────────────

  private async triggerSync(): Promise<void> {
    try {
      await enqueueSyncJob({
        mailAccountId: this.account.id,
        userId: this.account.userId,
      });
      logger.debug(
        { accountId: this.account.id },
        "[IDLE] Enqueued incremental sync",
      );
    } catch (err) {
      logger.error({ accountId: this.account.id, err }, "[IDLE] Failed to enqueue sync");
    }
  }

  // ─── Connection ───────────────────────────────────────────────────────────

  private async connect(): Promise<void> {
    const options: ImapFlowOptions = {
      host: this.account.imapHost,
      port: this.account.imapPort,
      secure: this.account.imapTls,
      auth: { user: this.account.email, pass: this.password },
      logger: false,
      tls: { rejectUnauthorized: true },
    };

    this.client = new ImapFlow(options);
    await this.client.connect();

    // Check IDLE capability
    const caps = this.client.capabilities;
    this.supportsIdle = caps ? caps.has("IDLE") : false;
  }

  private async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.logout();
    } catch {
      // Ignore disconnect errors
    } finally {
      this.client = null;
    }
  }

  // ─── Backoff ──────────────────────────────────────────────────────────────

  private getReconnectDelay(): number {
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS,
    );
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(delay + jitter));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
