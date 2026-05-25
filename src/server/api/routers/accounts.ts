/**
 * MailForge — Accounts tRPC Router
 *
 * Manages MailAccount entries: add, update, delete, test connections, set default.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { config } from "~/config";
import { encryptObject, decryptObject } from "~/lib/crypto";
import { isMailDomainAllowed } from "~/lib/config-utils";
import { ImapService } from "~/server/mail/imap";
import { createSmtpService, evictTransporter } from "~/server/mail/smtp";
import { scheduleAccountSync, unscheduleAccountSync } from "~/server/queue/scheduler";

// ─── Credential Types ─────────────────────────────────────────────────────────

interface StoredCredentials {
  imapPassword: string;
  smtpPassword: string;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const accountsRouter = createTRPCRouter({
  /**
   * List all mail accounts for the current user.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await db.mailAccount.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        email: true,
        displayName: true,
        imapHost: true,
        imapPort: true,
        imapTls: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        isDefault: true,
        isActive: true,
        syncedAt: true,
        color: true,
        emoji: true,
        createdAt: true,
        // Never expose raw credentials
      },
    });

    return accounts;
  }),

  /**
   * Add a new mail account.
   */
  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        displayName: z.string().optional(),
        imapPassword: z.string().min(1),
        smtpPassword: z.string().min(1),
        imapHost: z.string().min(1),
        imapPort: z.number().int().min(1).max(65535).default(993),
        imapTls: z.boolean().default(true),
        smtpHost: z.string().min(1),
        smtpPort: z.number().int().min(1).max(65535).default(587),
        smtpSecure: z.boolean().default(false),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        emoji: z.string().max(4).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      // Check domain allowlist
      if (!isMailDomainAllowed(input.email)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Email domain not allowed. Allowed domains: ${config.mail.allowedDomains.join(", ")}`,
        });
      }

      // Check account limit
      const existingCount = await db.mailAccount.count({
        where: { userId: session.user.id },
      });

      if (existingCount >= config.mail.maxAccountsPerUser) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Maximum ${config.mail.maxAccountsPerUser} mail accounts allowed per user`,
        });
      }

      // Encrypt credentials
      const credentials = encryptObject<StoredCredentials>({
        imapPassword: input.imapPassword,
        smtpPassword: input.smtpPassword,
      });

      // Check if this should be the default account
      const isDefault = existingCount === 0;

      const account = await db.mailAccount.create({
        data: {
          userId: session.user.id,
          email: input.email.toLowerCase(),
          displayName: input.displayName ?? null,
          credentials,
          imapHost: input.imapHost,
          imapPort: input.imapPort,
          imapTls: input.imapTls,
          smtpHost: input.smtpHost,
          smtpPort: input.smtpPort,
          smtpSecure: input.smtpSecure,
          isDefault,
          color: input.color ?? null,
          emoji: input.emoji ?? null,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          isDefault: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Schedule periodic sync
      await scheduleAccountSync(account.id, session.user.id).catch((err) =>
        console.error("[Accounts] Failed to schedule sync:", err),
      );

      return account;
    }),

  /**
   * Update a mail account's settings.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        displayName: z.string().optional(),
        imapPassword: z.string().min(1).optional(),
        smtpPassword: z.string().min(1).optional(),
        imapHost: z.string().min(1).optional(),
        imapPort: z.number().int().min(1).max(65535).optional(),
        imapTls: z.boolean().optional(),
        smtpHost: z.string().min(1).optional(),
        smtpPort: z.number().int().min(1).max(65535).optional(),
        smtpSecure: z.boolean().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        emoji: z.string().max(4).optional().nullable(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const account = await db.mailAccount.findFirst({
        where: { id: input.id, userId: session.user.id },
      });

      if (!account)
        throw new TRPCError({ code: "NOT_FOUND", message: "Mail account not found" });

      let credentialsUpdate: string | undefined;
      if (input.imapPassword ?? input.smtpPassword) {
        const existing = decryptObject<StoredCredentials>(account.credentials);
        credentialsUpdate = encryptObject<StoredCredentials>({
          imapPassword: input.imapPassword ?? existing.imapPassword,
          smtpPassword: input.smtpPassword ?? existing.smtpPassword,
        });
      }

      // Evict cached transporter if credentials changed
      if (credentialsUpdate) {
        evictTransporter(account.id);
      }

      const updated = await db.mailAccount.update({
        where: { id: input.id },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(credentialsUpdate ? { credentials: credentialsUpdate } : {}),
          ...(input.imapHost ? { imapHost: input.imapHost } : {}),
          ...(input.imapPort ? { imapPort: input.imapPort } : {}),
          ...(input.imapTls !== undefined ? { imapTls: input.imapTls } : {}),
          ...(input.smtpHost ? { smtpHost: input.smtpHost } : {}),
          ...(input.smtpPort ? { smtpPort: input.smtpPort } : {}),
          ...(input.smtpSecure !== undefined ? { smtpSecure: input.smtpSecure } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: { id: true, email: true, displayName: true, updatedAt: true },
      });

      return updated;
    }),

  /**
   * Delete a mail account and all associated messages.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const account = await db.mailAccount.findFirst({
        where: { id: input.id, userId: session.user.id },
      });

      if (!account)
        throw new TRPCError({ code: "NOT_FOUND", message: "Mail account not found" });

      // Unschedule periodic sync
      await unscheduleAccountSync(input.id).catch(() => null);

      // Cascade delete via Prisma (messages, attachments are cascade deleted)
      await db.mailAccount.delete({ where: { id: input.id } });

      // Reassign default if needed
      if (account.isDefault) {
        const next = await db.mailAccount.findFirst({
          where: { userId: session.user.id },
          orderBy: { createdAt: "asc" },
        });
        if (next) {
          await db.mailAccount.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }

      return { deleted: true };
    }),

  /**
   * Set a mail account as the default.
   */
  setDefault: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const account = await db.mailAccount.findFirst({
        where: { id: input.id, userId: session.user.id },
      });

      if (!account)
        throw new TRPCError({ code: "NOT_FOUND", message: "Mail account not found" });

      await db.$transaction([
        db.mailAccount.updateMany({
          where: { userId: session.user.id },
          data: { isDefault: false },
        }),
        db.mailAccount.update({
          where: { id: input.id },
          data: { isDefault: true },
        }),
      ]);

      return { updated: true };
    }),

  /**
   * Test IMAP connection for an existing or new account.
   */
  testImap: protectedProcedure
    .input(
      z.object({
        /** Provide id to test an existing account */
        id: z.string().cuid().optional(),
        /** Or provide credentials directly to test before saving */
        email: z.string().email().optional(),
        imapPassword: z.string().optional(),
        imapHost: z.string().optional(),
        imapPort: z.number().int().optional(),
        imapTls: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      let account: Parameters<typeof ImapService["prototype"]["testConnection"]> extends [] ? never : ConstructorParameters<typeof ImapService>[0];

      if (input.id) {
        const found = await db.mailAccount.findFirst({
          where: { id: input.id, userId: session.user.id },
        });
        if (!found)
          throw new TRPCError({ code: "NOT_FOUND", message: "Mail account not found" });
        account = found;
      } else {
        if (!input.email || !input.imapPassword || !input.imapHost) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "email, imapPassword, and imapHost are required",
          });
        }

        // Create a temporary account object for testing
        const tempCreds = encryptObject<StoredCredentials>({
          imapPassword: input.imapPassword,
          smtpPassword: input.imapPassword, // placeholder
        });

        account = {
          id: "temp",
          userId: session.user.id,
          email: input.email,
          displayName: null,
          credentials: tempCreds,
          imapHost: input.imapHost,
          imapPort: input.imapPort ?? 993,
          imapTls: input.imapTls ?? true,
          smtpHost: "",
          smtpPort: 587,
          smtpSecure: false,
          isDefault: false,
          isActive: true,
          syncedAt: null,
          color: null,
          emoji: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      const imap = new ImapService(account);
      return imap.testConnection();
    }),

  /**
   * Test SMTP connection.
   */
  testSmtp: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const account = await db.mailAccount.findFirst({
        where: { id: input.id, userId: session.user.id },
      });

      if (!account)
        throw new TRPCError({ code: "NOT_FOUND", message: "Mail account not found" });

      const smtp = createSmtpService(account);
      return smtp.verifyConnection();
    }),
});
