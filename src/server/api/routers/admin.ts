/**
 * MailForge — Admin tRPC Router
 *
 * Admin-only procedures for system management.
 * All procedures are protected by role=ADMIN check.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { config } from "~/config";
import { QueueMonitoringService } from "~/server/queue/monitoring.service";
import { RateLimitService } from "~/server/security/rate-limit.service";

// ─── Admin Guard Procedure ────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const adminRouter = createTRPCRouter({
  /**
   * Get system-wide statistics.
   */
  getStats: adminProcedure.query(async () => {
    const [
      totalUsers,
      totalMailAccounts,
      totalMessages,
      totalAttachments,
      recentUsers,
    ] = await Promise.all([
      db.user.count(),
      db.mailAccount.count(),
      db.message.count(),
      db.attachment.count(),
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      }),
    ]);

    return {
      totalUsers,
      totalMailAccounts,
      totalMessages,
      totalAttachments,
      recentUsers,
      appVersion: "2.0.0",
      maintenanceMode: config.advanced.maintenanceMode,
      uptime: process.uptime(),
    };
  }),

  /**
   * List all users.
   */
  listUsers: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z.enum(["USER", "ADMIN"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { search, role, limit, offset } = input;

      const [users, total] = await Promise.all([
        db.user.findMany({
          where: {
            ...(role ? { role } : {}),
            ...(search
              ? {
                  OR: [
                    { email: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            twoFactorEnabled: true,
            createdAt: true,
            _count: { select: { mailAccounts: true, sessions: true } },
          },
        }),
        db.user.count({
          where: {
            ...(role ? { role } : {}),
            ...(search
              ? {
                  OR: [
                    { email: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
        }),
      ]);

      return { users, total };
    }),

  /**
   * Update a user's role.
   */
  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.string().cuid(),
        role: z.enum(["USER", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change your own role",
        });
      }
      const user = await db.user.findUnique({ where: { id: input.userId } });
      if (!user)
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      return db.user.update({
        where: { id: input.userId },
        data: { role: input.role },
        select: { id: true, email: true, role: true },
      });
    }),

  /**
   * Suspend a user (deletes all their sessions).
   */
  suspendUser: adminProcedure
    .input(z.object({ userId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot suspend yourself",
        });
      }
      await db.session.deleteMany({ where: { userId: input.userId } });
      return { suspended: true };
    }),

  /**
   * Delete a user and all their data.
   */
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete yourself",
        });
      }
      await db.user.delete({ where: { id: input.userId } });
      return { deleted: true };
    }),

  /**
   * Toggle maintenance mode.
   */
  toggleMaintenance: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      config.advanced.maintenanceMode = input.enabled;
      return { maintenanceMode: config.advanced.maintenanceMode };
    }),

  /**
   * Get detailed queue statistics from all BullMQ queues.
   */
  getQueueStats: adminProcedure.query(async () => {
    return QueueMonitoringService.getQueueStats();
  }),

  /**
   * List failed jobs across all queues.
   */
  getFailedJobs: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      return QueueMonitoringService.getFailedJobs(input.limit);
    }),

  /**
   * Retry a failed job by ID.
   */
  retryJob: adminProcedure
    .input(
      z.object({
        queue: z.enum(["mail:sync", "mail:send", "notifications"]),
        jobId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await QueueMonitoringService.retryJob(input.queue, input.jobId);
      return { retried: true };
    }),

  /**
   * Permanently discard a failed job.
   */
  discardJob: adminProcedure
    .input(
      z.object({
        queue: z.enum(["mail:sync", "mail:send", "notifications"]),
        jobId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await QueueMonitoringService.discardJob(input.queue, input.jobId);
      return { discarded: true };
    }),

  /**
   * Trigger a full sync for all active mail accounts.
   */
  syncAllAccounts: adminProcedure.mutation(async () => {
    const { enqueueSyncJob } = await import("~/server/queue/client");

    const accounts = await db.mailAccount.findMany({
      where: { isActive: true },
      select: { id: true, userId: true },
    });

    let queued = 0;
    for (const account of accounts) {
      await enqueueSyncJob({
        mailAccountId: account.id,
        userId: account.userId,
        force: true,
      });
      queued++;
    }
    return { queued };
  }),

  /**
   * Ban an IP address.
   */
  banIp: adminProcedure
    .input(
      z.object({
        ip: z.string().ip(),
        durationSeconds: z.number().min(60).max(86400 * 30).default(3600),
      }),
    )
    .mutation(async ({ input }) => {
      await RateLimitService.banIp(input.ip, input.durationSeconds);
      return { banned: true, ip: input.ip };
    }),

  /**
   * Unban an IP address.
   */
  unbanIp: adminProcedure
    .input(z.object({ ip: z.string().ip() }))
    .mutation(async ({ input }) => {
      await RateLimitService.unbanIp(input.ip);
      return { unbanned: true, ip: input.ip };
    }),

  /**
   * List disabled mail accounts (circuit breaker triggered).
   */
  getDisabledAccounts: adminProcedure.query(async () => {
    return db.mailAccount.findMany({
      where: { isActive: false },
      select: {
        id: true,
        email: true,
        consecutiveSyncFailures: true,
        syncedAt: true,
        user: { select: { email: true } },
      },
    });
  }),

  /**
   * Re-enable a disabled account and reset its failure counter.
   */
  reEnableAccount: adminProcedure
    .input(z.object({ accountId: z.string().cuid() }))
    .mutation(async ({ input }) => {
      await db.mailAccount.update({
        where: { id: input.accountId },
        data: { isActive: true, consecutiveSyncFailures: 0 },
      });
      return { enabled: true };
    }),
});
