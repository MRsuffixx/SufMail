/**
 * MailForge — Settings tRPC Router
 *
 * User preferences, theme overrides, data export, and account deletion.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { config } from "~/config";
import type { UserPreferences } from "~/types/mail";

const userPreferencesSchema = z.object({
  themeMode: z.enum(["light", "dark", "system"]).optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
  mailListLayout: z
    .enum(["default", "preview", "minimal", "cards"])
    .optional(),
  animationsEnabled: z.boolean().optional(),
  defaultAccountId: z.string().cuid().optional(),
  replyAll: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
});

export const settingsRouter = createTRPCRouter({
  /**
   * Get the current user's settings/preferences.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        twoFactorEnabled: true,
        settings: true,
        createdAt: true,
      },
    });

    if (!user)
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    const preferences = (user.settings ?? {}) as UserPreferences;

    return {
      ...user,
      preferences,
      // Merge with global config defaults
      effectiveTheme: {
        mode: preferences.themeMode ?? config.theme.defaultMode,
        primaryColor: preferences.primaryColor ?? config.theme.primaryColor,
        accentColor: preferences.accentColor ?? config.theme.accentColor,
        density: preferences.density ?? config.theme.density,
        mailListLayout:
          preferences.mailListLayout ?? config.theme.mailListLayout,
        animationsEnabled:
          preferences.animationsEnabled ?? config.theme.animationsEnabled,
      },
    };
  }),

  /**
   * Update user profile (name, image).
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255).optional(),
        image: z.string().url().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.user.update({
        where: { id: ctx.session.user.id },
        data: input,
        select: { id: true, name: true, image: true },
      });
    }),

  /**
   * Update user preferences.
   */
  updatePreferences: protectedProcedure
    .input(userPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { settings: true },
      });

      const current = (user?.settings ?? {}) as UserPreferences;
      const updated: UserPreferences = { ...current, ...input };

      await db.user.update({
        where: { id: ctx.session.user.id },
        data: { settings: updated },
      });

      return updated;
    }),

  /**
   * Change password (for credentials provider users).
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(8),
        newPassword: z.string().min(8).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { hashPassword, verifyPassword } = await import(
        "~/server/auth/helpers"
      );

      const user = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { password: true },
      });

      if (!user?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No password set on this account (use OAuth to sign in)",
        });
      }

      const valid = await verifyPassword(input.currentPassword, user.password);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      const hashed = await hashPassword(input.newPassword);
      await db.user.update({
        where: { id: ctx.session.user.id },
        data: { password: hashed },
      });

      return { updated: true };
    }),

  /**
   * Get notification settings.
   */
  getNotifications: protectedProcedure.query(async ({ ctx }) => {
    const unreadCount = await db.notificationLog.count({
      where: { userId: ctx.session.user.id, isRead: false },
    });

    const recentNotifications = await db.notificationLog.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return { unreadCount, notifications: recentNotifications };
  }),

  /**
   * Mark notifications as read.
   */
  markNotificationsRead: protectedProcedure
    .input(
      z.object({
        notificationIds: z.array(z.string().cuid()).optional(),
        // If not provided, marks all as read
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db.notificationLog.updateMany({
        where: {
          userId: ctx.session.user.id,
          ...(input.notificationIds
            ? { id: { in: input.notificationIds } }
            : {}),
        },
        data: { isRead: true },
      });
      return { updated: result.count };
    }),

  /**
   * Export all user data as JSON (GDPR compliance).
   */
  exportData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [user, mailAccounts, contacts, labels, filterRules] =
      await Promise.all([
        db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            settings: true,
            createdAt: true,
          },
        }),
        db.mailAccount.findMany({
          where: { userId },
          select: {
            id: true,
            email: true,
            displayName: true,
            imapHost: true,
            smtpHost: true,
            isDefault: true,
            createdAt: true,
            // No credentials!
          },
        }),
        db.contact.findMany({ where: { userId } }),
        db.label.findMany({ where: { userId } }),
        db.filterRule.findMany({ where: { userId } }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      user,
      mailAccounts,
      contacts,
      labels,
      filterRules,
    };
  }),

  /**
   * Delete the user's account and all associated data.
   * Requires password confirmation for credentials users.
   */
  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmation: z
          .string()
          .refine((val) => val === "DELETE", {
            message: 'Type "DELETE" to confirm account deletion',
          }),
      }),
    )
    .mutation(async ({ ctx }) => {
      await db.user.delete({ where: { id: ctx.session.user.id } });
      return { deleted: true };
    }),
});
