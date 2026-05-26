/**
 * MailForge — Rate Limit Service
 *
 * Multi-layer rate limiting using Redis.
 * Supports IP-based, user-based, and endpoint-specific limits
 * using a sliding window counter strategy.
 */

import { getRedisConnection } from "~/server/queue/client";
import { config } from "~/config";
import type { RateLimitEndpoint } from "~/config";

export type RateLimitEndpointKey =
  | "global"
  | "login"
  | "sendEmail"
  | "syncTrigger"
  | "search";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs: number;
}

export interface BruteForceResult {
  blocked: boolean;
  attempts: number;
  lockoutExpiresAt?: Date;
  backoffMs: number;
}

// ─── Rate Limit Service ───────────────────────────────────────────────────────

export class RateLimitService {
  // ─── IP Rate Limiting ──────────────────────────────────────────────────

  /**
   * Check and increment an IP-based sliding window counter.
   */
  static async checkIpLimit(
    ip: string,
    endpoint: RateLimitEndpointKey = "global",
  ): Promise<RateLimitResult> {
    const cfg = config.security.rateLimit[endpoint] as RateLimitEndpoint;
    const key = `rl:ip:${endpoint}:${ip}`;
    return RateLimitService.checkSlidingWindow(key, cfg);
  }

  /**
   * Check and increment a user-based sliding window counter.
   */
  static async checkUserLimit(
    userId: string,
    endpoint: RateLimitEndpointKey = "global",
  ): Promise<RateLimitResult> {
    const cfg = config.security.rateLimit[endpoint] as RateLimitEndpoint;
    const key = `rl:user:${endpoint}:${userId}`;
    return RateLimitService.checkSlidingWindow(key, cfg);
  }

  // ─── Brute-Force Detection ────────────────────────────────────────────

  /**
   * Record a failed login attempt for an IP.
   * Returns current brute-force state.
   */
  static async recordFailedLogin(
    ip: string,
    userId?: string,
  ): Promise<BruteForceResult> {
    const redis = getRedisConnection();
    const bf = config.security.bruteForce;
    const ipKey = `bf:ip:${ip}`;
    const lockKey = `bf:lock:${ip}`;

    const luaScript = `
      local lock = redis.call('GET', KEYS[1])
      if lock then
        return {1, redis.call('TTL', KEYS[1])}
      end
      local attempts = redis.call('INCR', KEYS[2])
      redis.call('EXPIRE', KEYS[2], ARGV[1])
      return {0, attempts}
    `;

    const result = await redis.eval(
      luaScript,
      2,
      lockKey,
      ipKey,
      bf.lockoutDurationSeconds,
    ) as [number, number];

    if (result[0] === 1) {
      return {
        blocked: true,
        attempts: bf.maxAttempts,
        lockoutExpiresAt: new Date(Date.now() + result[1] * 1000),
        backoffMs: result[1] * 1000,
      };
    }

    const attempts = result[1];

    if (userId) {
      const userKey = `bf:user:${userId}`;
      await redis.incr(userKey);
      await redis.expire(userKey, bf.lockoutDurationSeconds);
    }

    if (attempts >= bf.maxAttempts) {
      const extra = attempts - bf.maxAttempts;
      const multiplied = Math.min(
        bf.lockoutDurationSeconds * Math.pow(bf.backoffMultiplier, extra),
        86400,
      );
      await redis.set(lockKey, "1", "EX", Math.ceil(multiplied));
      return {
        blocked: true,
        attempts,
        lockoutExpiresAt: new Date(Date.now() + multiplied * 1000),
        backoffMs: multiplied * 1000,
      };
    }

    const backoffMs = Math.min(
      1000 * Math.pow(bf.backoffMultiplier, attempts - 1),
      30_000,
    );
    return { blocked: false, attempts, backoffMs };
  }

  /**
   * Record a successful login — clears brute-force counters.
   */
  static async recordSuccessfulLogin(ip: string, userId: string): Promise<void> {
    const redis = getRedisConnection();
    await redis.del(`bf:ip:${ip}`, `bf:lock:${ip}`, `bf:user:${userId}`);
  }

  /**
   * Check whether an IP is currently banned/locked out.
   */
  static async isIpBanned(ip: string): Promise<boolean> {
    const redis = getRedisConnection();
    const val = await redis.get(`bf:lock:${ip}`);
    return val !== null;
  }

  /**
   * Manually ban an IP for a specified duration.
   */
  static async banIp(ip: string, durationSeconds: number): Promise<void> {
    const redis = getRedisConnection();
    await redis.set(`bf:lock:${ip}`, "1", "EX", durationSeconds);
  }

  /**
   * Remove an IP ban manually.
   */
  static async unbanIp(ip: string): Promise<void> {
    const redis = getRedisConnection();
    await redis.del(`bf:lock:${ip}`, `bf:ip:${ip}`);
  }

  // ─── SMTP Throttle ────────────────────────────────────────────────────

  /**
   * Check if a user has exceeded their per-minute SMTP send limit.
   */
  static async checkSmtpSendLimit(userId: string): Promise<RateLimitResult> {
    const limit = config.security.rateLimit.smtpSendsPerMinute;
    const key = `rl:smtp:${userId}`;
    return RateLimitService.checkSlidingWindow(key, {
      windowMs: 60_000,
      max: limit,
    });
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  /**
   * Sliding window rate limit check using Redis INCR + PEXPIRE.
   * Increments counter, sets TTL on first hit, returns allow/deny.
   */
  private static async checkSlidingWindow(
    key: string,
    cfg: RateLimitEndpoint,
  ): Promise<RateLimitResult> {
    const redis = getRedisConnection();
    const windowSeconds = Math.ceil(cfg.windowMs / 1000);

    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.pttl(key);
    const results = await pipeline.exec();

    const count = (results?.[0]?.[1] as number) ?? 1;
    let ttlMs = (results?.[1]?.[1] as number) ?? -1;

    // Set TTL on first request in the window
    if (ttlMs < 0) {
      await redis.expire(key, windowSeconds);
      ttlMs = cfg.windowMs;
    }

    const remaining = Math.max(0, cfg.max - count);
    const resetAt = new Date(Date.now() + ttlMs);
    const retryAfterMs = count > cfg.max ? ttlMs : 0;

    return {
      allowed: count <= cfg.max,
      remaining,
      resetAt,
      retryAfterMs,
    };
  }
}
