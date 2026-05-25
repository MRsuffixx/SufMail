/**
 * MailForge — Structured Logger
 *
 * Pino-based structured logger with configurable log level,
 * pretty printing in development, and request trace ID support.
 */

import pino from "pino";
import { config } from "~/config";

// ─── Logger Instance ──────────────────────────────────────────────────────────

const isDev =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

export const logger = pino({
  level: config.advanced.logLevel,
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }
    : {
        // Production: structured JSON
        formatters: {
          level(label: string) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

// ─── Request Logger ───────────────────────────────────────────────────────────

/**
 * Creates a child logger with a request-scoped trace ID.
 */
export function createRequestLogger(traceId: string): pino.Logger {
  return logger.child({ traceId });
}

/**
 * Generates a new random trace ID.
 */
export function generateTraceId(): string {
  return crypto.randomUUID();
}

// ─── Context Loggers ──────────────────────────────────────────────────────────

export const imapLogger = logger.child({ service: "imap" });
export const smtpLogger = logger.child({ service: "smtp" });
export const syncLogger = logger.child({ service: "sync" });
export const queueLogger = logger.child({ service: "queue" });
export const authLogger = logger.child({ service: "auth" });
export const cacheLogger = logger.child({ service: "cache" });
export const searchLogger = logger.child({ service: "search" });
