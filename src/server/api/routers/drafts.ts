/**
 * MailForge — Drafts tRPC Router
 *
 * Auto-save drafts, list, delete, schedule sending.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { enqueueSendJob } from "~/server/queue/client";
import { syncLogger } from "~/lib/logger";
import DOMPurify from "dompurify";

// Sanitize HTML to prevent XSS attacks
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "a", "img",
      "table", "thead", "tbody", "tr", "th", "td",
      "span", "div",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "class", "style", "target"],
    ALLOW_DATA_ATTR: false,
  });
}

const emailAddressSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const draftsRouter = createTRPCRouter({
  /**
   * List all drafts for the current user.
   */
  list: protectedProcedure
    .input(
      z.object({
        mailAccountId: z.string().cuid().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { session } = ctx;

      const [drafts, total] = await Promise.all([
        db.draft.findMany({
          where: {
            userId: session.user.id,
            ...(input.mailAccountId
              ? { mailAccountId: input.mailAccountId }
              : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
          skip: input.offset,
          select: {
            id: true,
            to: true,
            subject: true,
            updatedAt: true,
            scheduledAt: true,
            mailAccountId: true,
          },
        }),
        db.draft.count({
          where: {
            userId: session.user.id,
            ...(input.mailAccountId
              ? { mailAccountId: input.mailAccountId }
              : {}),
          },
        }),
      ]);

      return { drafts, total };
    }),

  /**
   * Get a single draft by ID.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const draft = await db.draft.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!draft)
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

      return draft;
    }),

  /**
   * Auto-save a draft (create or update).
   */
  save: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid().optional(), // Omit to create new
        mailAccountId: z.string().cuid().optional().nullable(),
        to: z.array(emailAddressSchema).default([]),
        cc: z.array(emailAddressSchema).default([]),
        bcc: z.array(emailAddressSchema).default([]),
        subject: z.string().max(998).optional().nullable(),
        bodyHtml: z.string().max(10 * 1024 * 1024).optional().nullable(),
        inReplyTo: z.string().optional().nullable(),
        references: z.string().optional().nullable(),
        scheduledAt: z.string().datetime().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      const { id, bodyHtml, ...rest } = input;

      // Sanitize HTML to prevent XSS
      const sanitizedBodyHtml = bodyHtml ? sanitizeHtml(bodyHtml) : bodyHtml;

      if (id) {
        // Update existing draft
        const existing = await db.draft.findFirst({
          where: { id, userId: session.user.id },
        });

        if (!existing)
          throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        return db.draft.update({
          where: { id },
          data: {
            ...rest,
            bodyHtml: sanitizedBodyHtml,
            scheduledAt: rest.scheduledAt ? new Date(rest.scheduledAt) : null,
          },
        });
      }

      // Create new draft
      return db.draft.create({
        data: {
          userId: session.user.id,
          ...rest,
          bodyHtml: sanitizedBodyHtml,
          scheduledAt: rest.scheduledAt ? new Date(rest.scheduledAt) : null,
        },
      });
    }),

  /**
   * Delete a draft.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await db.draft.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!draft)
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

      await db.draft.delete({ where: { id: input.id } });
      return { deleted: true };
    }),

  /**
   * Schedule a draft to be sent at a specific time.
   */
  schedule: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        scheduledAt: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const draft = await db.draft.findFirst({
        where: { id: input.id, userId: session.user.id },
      });

      if (!draft)
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

      if (!draft.mailAccountId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Draft must have a mail account to schedule",
        });
      }

      const scheduledDate = new Date(input.scheduledAt);
      const delay = Math.max(0, scheduledDate.getTime() - Date.now());

      await db.draft.update({
        where: { id: input.id },
        data: { scheduledAt: scheduledDate },
      });

      await enqueueSendJob(
        {
          draftId: draft.id,
          userId: session.user.id,
          mailAccountId: draft.mailAccountId,
          scheduledAt: input.scheduledAt,
        },
        delay,
      );

      return { scheduled: true, scheduledAt: scheduledDate };
    }),

  /**
   * Cancel a scheduled draft send.
   */
  cancelSchedule: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await db.draft.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!draft)
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

      await db.draft.update({
        where: { id: input.id },
        data: { scheduledAt: null },
      });

      // Note: Removing the job from BullMQ requires the job ID
      // The worker will check if scheduledAt is null before sending
      const { mailSendQueue } = await import("~/server/queue/client");
      await mailSendQueue.remove(`send:${draft.id}`).catch((removeErr) => {
        const msg = removeErr instanceof Error ? removeErr.message : String(removeErr);
        if (!msg.includes("Not found") && !msg.includes("Job")) {
          syncLogger.warn({ draftId: draft.id, err: removeErr }, "[Drafts] Failed to remove send job");
        }
      });

      return { cancelled: true };
    }),
});
