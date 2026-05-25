/**
 * MailForge — Cache Service
 *
 * Redis-backed cache-aside service with typed TTL policies per data type.
 * All cache misses fall through to the DB; hits return immediately.
 */

import { getRedisConnection } from "~/server/queue/client";
import { cacheLogger } from "~/lib/logger";

// ─── TTL Policies (seconds) ───────────────────────────────────────────────────

const TTL = {
  messageList: 30,
  thread: 60,
  searchResult: 120,
  mailboxList: 300,
  userLabels: 120,
} as const;

type TtlKey = keyof typeof TTL;

// ─── Key Builders ─────────────────────────────────────────────────────────────

export const CacheKey = {
  messageList: (userId: string, filter: string) =>
    `cache:messages:${userId}:${filter}`,
  thread: (threadId: string) => `cache:thread:${threadId}`,
  searchResult: (userId: string, query: string) =>
    `cache:search:${userId}:${Buffer.from(query).toString("base64")}`,
  mailboxList: (accountId: string) => `cache:mailboxes:${accountId}`,
  userLabels: (userId: string) => `cache:labels:${userId}`,
};

// ─── Cache Service ────────────────────────────────────────────────────────────

export class CacheService {
  /**
   * Gets a cached value. Returns null on miss.
   */
  static async get<T>(key: string): Promise<T | null> {
    const redis = getRedisConnection();
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      cacheLogger.warn({ key, err }, "Cache get error");
      return null;
    }
  }

  /**
   * Sets a value in cache with the given TTL policy.
   */
  static async set<T>(
    key: string,
    value: T,
    ttlType: TtlKey,
  ): Promise<void> {
    const redis = getRedisConnection();
    try {
      await redis.set(key, JSON.stringify(value), "EX", TTL[ttlType]);
    } catch (err) {
      cacheLogger.warn({ key, err }, "Cache set error");
    }
  }

  /**
   * Sets a value with an explicit TTL in seconds.
   */
  static async setWithTtl<T>(
    key: string,
    value: T,
    ttlSeconds: number,
  ): Promise<void> {
    const redis = getRedisConnection();
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      cacheLogger.warn({ key, err }, "Cache setWithTtl error");
    }
  }

  /**
   * Deletes one or more cache keys.
   */
  static async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const redis = getRedisConnection();
    try {
      await redis.del(...keys);
    } catch (err) {
      cacheLogger.warn({ keys, err }, "Cache del error");
    }
  }

  /**
   * Deletes all keys matching a pattern (uses SCAN for safety).
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    const redis = getRedisConnection();
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          "100",
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (err) {
      cacheLogger.warn({ pattern, err }, "Cache invalidatePattern error");
    }
  }

  /**
   * Invalidates all message list caches for a user.
   */
  static async invalidateUserMessages(userId: string): Promise<void> {
    await CacheService.invalidatePattern(`cache:messages:${userId}:*`);
  }

  /**
   * Invalidates a thread cache.
   */
  static async invalidateThread(threadId: string): Promise<void> {
    await CacheService.del(CacheKey.thread(threadId));
  }

  /**
   * Invalidates all search caches for a user.
   */
  static async invalidateUserSearch(userId: string): Promise<void> {
    await CacheService.invalidatePattern(`cache:search:${userId}:*`);
  }

  /**
   * Invalidates user label cache.
   */
  static async invalidateUserLabels(userId: string): Promise<void> {
    await CacheService.del(CacheKey.userLabels(userId));
  }

  /**
   * Cache-aside helper: get from cache, or compute + store.
   */
  static async getOrSet<T>(
    key: string,
    ttlType: TtlKey,
    compute: () => Promise<T>,
  ): Promise<T> {
    const cached = await CacheService.get<T>(key);
    if (cached !== null) return cached;

    const value = await compute();
    await CacheService.set(key, value, ttlType);
    return value;
  }
}
