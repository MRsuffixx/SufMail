/**
 * Vitest global test setup.
 * Mocks environment variables and DB before test runs.
 */

import { vi } from "vitest";

// Mock the DB client to prevent real DB calls in unit tests
vi.mock("~/server/db", () => ({
  db: {
    message: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    thread: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    mailAccount: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    attachment: {
      upsert: vi.fn(),
    },
    label: {
      findFirst: vi.fn(),
    },
    messageLabel: {
      upsert: vi.fn(),
    },
    userKeySalt: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock Redis
vi.mock("~/server/queue/client", () => ({
  getRedisConnection: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    pttl: vi.fn().mockResolvedValue(-1),
    pipeline: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      pttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 1], [null, -1]]),
    })),
    scan: vi.fn().mockResolvedValue(["0", []]),
    quit: vi.fn().mockResolvedValue("OK"),
  })),
  enqueueSyncJob: vi.fn().mockResolvedValue(undefined),
  enqueueSendJob: vi.fn().mockResolvedValue(undefined),
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
  mailSyncQueue: { getJobCounts: vi.fn(), getFailed: vi.fn(), getJob: vi.fn() },
  mailSendQueue: { getJobCounts: vi.fn(), getFailed: vi.fn(), getJob: vi.fn() },
  notificationQueue: { getJobCounts: vi.fn(), getFailed: vi.fn(), getJob: vi.fn() },
}));

// Set test env vars
process.env.ENCRYPTION_KEY = "a".repeat(64);
process.env.ENCRYPTION_KEY_VERSION = "1";
process.env.NODE_ENV = "test";
