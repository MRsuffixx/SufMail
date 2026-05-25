/**
 * MailForge — Prometheus Metrics Service
 *
 * prom-client based metrics for observability.
 * Exposed at /api/metrics in Prometheus text format.
 */

import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";

// ─── Registry ─────────────────────────────────────────────────────────────────

export const metricsRegistry = new Registry();

// Collect default Node.js process metrics
collectDefaultMetrics({ register: metricsRegistry });

// ─── Mail Sync Metrics ────────────────────────────────────────────────────────

export const messagesSyncedTotal = new Counter({
  name: "mailforge_messages_synced_total",
  help: "Total number of messages synced from IMAP",
  labelNames: ["account_id", "mailbox"] as const,
  registers: [metricsRegistry],
});

export const syncErrorsTotal = new Counter({
  name: "mailforge_sync_errors_total",
  help: "Total number of IMAP sync errors",
  labelNames: ["account_id", "error_type"] as const,
  registers: [metricsRegistry],
});

export const imapLatencyMs = new Histogram({
  name: "mailforge_imap_latency_ms",
  help: "IMAP operation latency in milliseconds",
  labelNames: ["operation"] as const,
  buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [metricsRegistry],
});

// ─── SMTP Metrics ─────────────────────────────────────────────────────────────

export const messagesSentTotal = new Counter({
  name: "mailforge_messages_sent_total",
  help: "Total number of emails sent via SMTP",
  labelNames: ["account_id"] as const,
  registers: [metricsRegistry],
});

export const smtpErrorsTotal = new Counter({
  name: "mailforge_smtp_errors_total",
  help: "Total number of SMTP send errors",
  labelNames: ["account_id", "error_type"] as const,
  registers: [metricsRegistry],
});

export const smtpLatencyMs = new Histogram({
  name: "mailforge_smtp_latency_ms",
  help: "SMTP send operation latency in milliseconds",
  buckets: [100, 250, 500, 1000, 2500, 5000],
  registers: [metricsRegistry],
});

// ─── Search Metrics ───────────────────────────────────────────────────────────

export const searchLatencyMs = new Histogram({
  name: "mailforge_search_latency_ms",
  help: "Search query latency in milliseconds",
  labelNames: ["provider"] as const,
  buckets: [10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry],
});

export const searchQueriesTotal = new Counter({
  name: "mailforge_search_queries_total",
  help: "Total number of search queries executed",
  labelNames: ["provider"] as const,
  registers: [metricsRegistry],
});

// ─── Queue Metrics ────────────────────────────────────────────────────────────

export const queueBacklogDepth = new Gauge({
  name: "mailforge_queue_backlog_depth",
  help: "Number of jobs waiting in each queue",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry],
});

export const queueJobsCompletedTotal = new Counter({
  name: "mailforge_queue_jobs_completed_total",
  help: "Total number of jobs completed per queue",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry],
});

export const queueJobsFailedTotal = new Counter({
  name: "mailforge_queue_jobs_failed_total",
  help: "Total number of jobs failed per queue",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry],
});

// ─── Auth Metrics ─────────────────────────────────────────────────────────────

export const loginAttemptsTotal = new Counter({
  name: "mailforge_login_attempts_total",
  help: "Total number of login attempts",
  labelNames: ["result"] as const, // success | failure | blocked
  registers: [metricsRegistry],
});

export const rateLimitHitsTotal = new Counter({
  name: "mailforge_rate_limit_hits_total",
  help: "Total number of rate limit hits",
  labelNames: ["endpoint", "type"] as const, // type: ip | user
  registers: [metricsRegistry],
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Records IMAP operation duration.
 */
export function recordImapLatency(
  operation: string,
  startTime: number,
): void {
  imapLatencyMs.labels(operation).observe(Date.now() - startTime);
}

/**
 * Records SMTP send duration.
 */
export function recordSmtpLatency(startTime: number): void {
  smtpLatencyMs.observe(Date.now() - startTime);
}

/**
 * Records search query duration.
 */
export function recordSearchLatency(
  provider: "postgres" | "meilisearch",
  startTime: number,
): void {
  searchLatencyMs.labels(provider).observe(Date.now() - startTime);
  searchQueriesTotal.labels(provider).inc();
}
