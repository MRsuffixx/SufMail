/**
 * MailForge — Mail tRPC Router
 *
 * All mail operations: listing, reading, sending, organizing.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { config } from "~/config";
import { searchMessages } from "~/lib/search";
import { getSignedUrl } from "~/lib/storage";
import { enqueueSyncJob, enqueueSendJob } from "~/server/queue/client";
import type { MessageListItem, FullMessage } from "~/types/mail";

// ─── Shared Input Schemas ─────────────────────────────────────────────────────

const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(), // message ID for cursor-based pagination
});

const bulkMessageSchema = z.object({
  messageIds: z.array(z.string().cuid()).min(1).max(100),
});

const emailAddressSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const mailRouter = createTRPCRouter({
  /**
   * List messages with filtering and pagination.
   */
  listMessages: protectedProcedure
    .input(
      z.object({
        ...paginationSchema.shape,
        mailAccountId: z.string().cuid().optional(),
        labelId: z.string().cuid().optional(),
        isRead: z.boolean().optional(),
        isStarred: z.boolean().optional(),
        isSnoozed: z.boolean().optional(),
        isDraft: z.boolean().optional(),
        isSent: z.boolean().optional(),
        isSpam: z.boolean().optional(),
        isArchived: z.boolean().optional(),
        sort: z.enum(["date", "sender", "subject"]).default("date"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { session } = ctx;
      const {
        limit,
        cursor,
        mailAccountId,
        labelId,
        isRead,
        isStarred,
        isSnoozed,
        isDraft,
        isSent,
        isSpam,
        isArchived,
        sort,
      } = input;

      // Verify mail account belongs to user
      if (mailAccountId) {
        const account = await db.mailAccount.findFirst({
          where: { id: mailAccountId, userId: session.user.id },
        });
        if (!account)
          throw new TRPCError({ code: "NOT_FOUND", message: "Mail account not found" });
      }

      const sortField =
        sort === "sender"
          ? "fromEmail"
          : sort === "subject"
            ? "subject"
            : "receivedAt";

      const messages = await db.message.findMany({
        where: {
          mailAccount: { userId: session.user.id },
          ...(mailAccountId ? { mailAccountId } : {}),
          ...(isRead !== undefined ? { isRead } : {}),
          ...(isStarred !== undefined ? { isStarred } : {}),
          ...(isSnoozed !== undefined ? { isSnoozed } : {}),
          ...(isDraft !== undefined ? { isDraft } : {}),
          ...(isSent !== undefined ? { isSent } : {}),
          ...(isSpam !== undefined ? { isSpam } : {}),
          ...(isArchived !== undefined ? { isArchived } : {}),
          ...(labelId
            ? { messageLabels: { some: { labelId } } }
            : { isDeleted: false }),
          ...(cursor
            ? {
                receivedAt: {
                  lt:
                    (
                      await db.message.findUnique({
                        where: { id: cursor },
                        select: { receivedAt: true },
                      })
                    )?.receivedAt ?? new Date(),
                },
              }
            : {}),
        },
        orderBy: { [sortField]: "desc" },
        take: limit + 1,
        include: {
          messageLabels: { include: { label: true } },
          _count: { select: { attachments: true } },
        },
      });

      const hasMore = messages.length > limit;
      const items = hasMore ? messages.slice(0, -1) : messages;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      const messageList: MessageListItem[] = items.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        messageId: msg.messageId,
        subject: msg.subject,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        snippet: msg.snippet,
        isRead: msg.isRead,
        isStarred: msg.isStarred,
        isSnoozed: msg.isSnoozed,
        snoozeUntil: msg.snoozeUntil,
        receivedAt: msg.receivedAt,
        sentAt: msg.sentAt,
        attachmentCount: msg._count.attachments,
        labels: msg.messageLabels.map((ml) => ({
          id: ml.label.id,
          name: ml.label.name,
          color: ml.label.color,
          icon: ml.label.icon,
          type: ml.label.type,
          isSystem: ml.label.isSystem,
        })),
      }));

      return { messages: messageList, nextCursor, hasMore };
    }),

  /**
   * Get a single message with full body and attachments.
   */
  getMessage: protectedProcedure
    .input(z.object({ messageId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const { session } = ctx;

      const msg = await db.message.findFirst({
        where: {
          id: input.messageId,
          mailAccount: { userId: session.user.id },
        },
        include: {
          attachments: true,
          messageLabels: { include: { label: true } },
          _count: { select: { attachments: true } },
        },
      });

      if (!msg)
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });

      // Auto-mark as read based on config
      if (!msg.isRead && config.behavior.markReadDelaySeconds !== null) {
        // Mark immediately if delay is 0, otherwise frontend handles delay
        if (config.behavior.markReadDelaySeconds === 0) {
          await db.message.update({
            where: { id: msg.id },
            data: { isRead: true },
          });
        }
      }

      // Resolve signed URLs for attachments
      const attachmentsWithUrls = await Promise.all(
        msg.attachments.map(async (att) => ({
          id: att.id,
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          storageKey: att.storageKey,
          isInline: att.isInline,
          contentId: att.contentId ?? undefined,
          url: await getSignedUrl(att.storageKey).catch(() => undefined),
        })),
      );

      const fullMessage: FullMessage = {
        id: msg.id,
        threadId: msg.threadId,
        messageId: msg.messageId,
        subject: msg.subject,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        snippet: msg.snippet,
        isRead: msg.isRead,
        isStarred: msg.isStarred,
        isSnoozed: msg.isSnoozed,
        snoozeUntil: msg.snoozeUntil,
        receivedAt: msg.receivedAt,
        sentAt: msg.sentAt,
        attachmentCount: msg._count.attachments,
        labels: msg.messageLabels.map((ml) => ({
          id: ml.label.id,
          name: ml.label.name,
          color: ml.label.color,
          icon: ml.label.icon,
          type: ml.label.type,
          isSystem: ml.label.isSystem,
        })),
        toAddresses: (msg.toAddresses as Array<{ email: string; name?: string }>) ?? [],
        ccAddresses: (msg.ccAddresses as Array<{ email: string; name?: string }>) ?? [],
        bccAddresses: (msg.bccAddresses as Array<{ email: string; name?: string }>) ?? [],
        bodyHtml: msg.bodyHtml,
        bodyText: msg.bodyText,
        attachments: attachmentsWithUrls,
        headers: (msg.headers as Record<string, string>) ?? {},
        size: msg.size,
        mailAccountId: msg.mailAccountId,
        rawPath: msg.rawPath,
      };

      return fullMessage;
    }),

  /**
   * Send a new message (enqueues via BullMQ).
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        mailAccountId: z.string().cuid(),
        to: z.array(emailAddressSchema).min(1),
        cc: z.array(emailAddressSchema).optional().default([]),
        bcc: z.array(emailAddressSchema).optional().default([]),
        subject: z.string().min(1).max(998),
        bodyHtml: z.string().max(10 * 1024 * 1024),
        inReplyTo: z.string().optional(),
        references: z.string().optional(),
        scheduledAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const account = await db.mailAccount.findFirst({
        where: { id: input.mailAccountId, userId: session.user.id },
      });
      if (!account)
        throw new TRPCError({ code: "NOT_FOUND", message: "Mail account not found" });

      // Create a draft first
      const draft = await db.draft.create({
        data: {
          userId: session.user.id,
          mailAccountId: input.mailAccountId,
          to: input.to,
          cc: input.cc,
          bcc: input.bcc,
          subject: input.subject,
          bodyHtml: input.bodyHtml,
          inReplyTo: input.inReplyTo ?? null,
          references: input.references ?? null,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        },
      });

      // Calculate delay for scheduled sends
      const delay = input.scheduledAt
        ? Math.max(0, new Date(input.scheduledAt).getTime() - Date.now())
        : undefined;

      await enqueueSendJob(
        {
          draftId: draft.id,
          userId: session.user.id,
          mailAccountId: input.mailAccountId,
          scheduledAt: input.scheduledAt ?? null,
        },
        delay,
      );

      return { draftId: draft.id, queued: true };
    }),

  /**
   * Reply to a message.
   */
  replyMessage: protectedProcedure
    .input(
      z.object({
        originalMessageId: z.string().cuid(),
        mailAccountId: z.string().cuid(),
        to: z.array(emailAddressSchema).min(1),
        cc: z.array(emailAddressSchema).optional().default([]),
        subject: z.string().min(1).max(998),
        bodyHtml: z.string().max(10 * 1024 * 1024),
        replyAll: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const original = await db.message.findFirst({
        where: {
          id: input.originalMessageId,
          mailAccount: { userId: session.user.id },
        },
      });

      if (!original)
        throw new TRPCError({ code: "NOT_FOUND", message: "Original message not found" });

      // When replyAll is true, include the original CC recipients
      const originalCc = input.replyAll
        ? (original.ccAddresses as Array<{ email: string; name?: string }> ?? [])
        : [];

      // Merge caller-provided CC with the original CC (deduplicate by email)
      const mergedCcMap = new Map<string, { email: string; name?: string }>();
      for (const addr of [...originalCc, ...input.cc]) {
        mergedCcMap.set(addr.email.toLowerCase(), addr);
      }
      const mergedCc = Array.from(mergedCcMap.values());

      const draft = await db.draft.create({
        data: {
          userId: session.user.id,
          mailAccountId: input.mailAccountId,
          to: input.to,
          cc: mergedCc,
          subject: /^re:/i.test(input.subject)
            ? input.subject
            : `Re: ${input.subject}`,
          bodyHtml: input.bodyHtml,
          inReplyTo: original.messageId,
          references: original.messageId,
        },
      });

      await enqueueSendJob({
        draftId: draft.id,
        userId: session.user.id,
        mailAccountId: input.mailAccountId,
        scheduledAt: null,
      });

      return { draftId: draft.id, queued: true };
    }),

  /**
   * Forward a message.
   */
  forwardMessage: protectedProcedure
    .input(
      z.object({
        originalMessageId: z.string().cuid(),
        mailAccountId: z.string().cuid(),
        to: z.array(emailAddressSchema).min(1),
        bodyHtml: z.string().max(10 * 1024 * 1024),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const original = await db.message.findFirst({
        where: {
          id: input.originalMessageId,
          mailAccount: { userId: session.user.id },
        },
      });

      if (!original)
        throw new TRPCError({ code: "NOT_FOUND", message: "Original message not found" });

      const draft = await db.draft.create({
        data: {
          userId: session.user.id,
          mailAccountId: input.mailAccountId,
          to: input.to,
          subject: original.subject?.startsWith("Fwd:")
            ? (original.subject ?? "")
            : `Fwd: ${original.subject ?? ""}`,
          bodyHtml: input.bodyHtml,
        },
      });

      await enqueueSendJob({
        draftId: draft.id,
        userId: session.user.id,
        mailAccountId: input.mailAccountId,
        scheduledAt: null,
      });

      return { draftId: draft.id, queued: true };
    }),

  /**
   * Move messages to a label (bulk).
   */
  moveToLabel: protectedProcedure
    .input(
      bulkMessageSchema.extend({
        labelId: z.string().cuid(),
        removeOtherSystemLabels: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      // Verify label belongs to user
      const label = await db.label.findFirst({
        where: { id: input.labelId, userId: session.user.id },
      });
      if (!label)
        throw new TRPCError({ code: "NOT_FOUND", message: "Label not found" });

      // Verify messages belong to user
      const messages = await db.message.findMany({
        where: {
          id: { in: input.messageIds },
          mailAccount: { userId: session.user.id },
        },
        select: { id: true },
      });

      if (messages.length === 0) return { updated: 0 };

      const messageIds = messages.map((m) => m.id);

      // If removeOtherSystemLabels is true, first delete all system label associations
      // on these messages so the move is exclusive (like a folder move).
      if (input.removeOtherSystemLabels) {
        await db.messageLabel.deleteMany({
          where: {
            messageId: { in: messageIds },
            label: { isSystem: true },
          },
        });
      }

      await db.messageLabel.createMany({
        data: messageIds.map((msgId) => ({
          messageId: msgId,
          labelId: input.labelId,
        })),
        skipDuplicates: true,
      });

      return { updated: messageIds.length };
    }),

  /**
   * Toggle read status (bulk).
   */
  toggleRead: protectedProcedure
    .input(bulkMessageSchema.extend({ isRead: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      const result = await db.message.updateMany({
        where: {
          id: { in: input.messageIds },
          mailAccount: { userId: session.user.id },
        },
        data: { isRead: input.isRead },
      });
      return { updated: result.count };
    }),

  /**
   * Toggle star status (bulk).
   */
  toggleStar: protectedProcedure
    .input(bulkMessageSchema.extend({ isStarred: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      const result = await db.message.updateMany({
        where: {
          id: { in: input.messageIds },
          mailAccount: { userId: session.user.id },
        },
        data: { isStarred: input.isStarred },
      });
      return { updated: result.count };
    }),

  /**
   * Delete messages (soft delete or permanent).
   */
  deleteMessages: protectedProcedure
    .input(bulkMessageSchema.extend({ permanent: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      if (input.permanent) {
        const result = await db.message.deleteMany({
          where: {
            id: { in: input.messageIds },
            mailAccount: { userId: session.user.id },
          },
        });
        return { deleted: result.count };
      }

      const result = await db.message.updateMany({
        where: {
          id: { in: input.messageIds },
          mailAccount: { userId: session.user.id },
        },
        data: { isDeleted: true },
      });
      return { deleted: result.count };
    }),

  /**
   * Snooze a message until a specified time.
   */
  snoozeMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string().cuid(),
        snoozeUntil: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      const snoozeDate = new Date(input.snoozeUntil);

      const message = await db.message.findFirst({
        where: {
          id: input.messageId,
          mailAccount: { userId: session.user.id },
        },
      });

      if (!message)
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });

      await db.$transaction([
        db.message.update({
          where: { id: input.messageId },
          data: { isSnoozed: true, snoozeUntil: snoozeDate },
        }),
        db.snoozedMessage.upsert({
          where: { messageId: input.messageId },
          create: {
            messageId: input.messageId,
            userId: session.user.id,
            snoozeUntil: snoozeDate,
          },
          update: { snoozeUntil: snoozeDate },
        }),
      ]);

      return { snoozed: true, snoozeUntil: snoozeDate };
    }),

  /**
   * Trigger a mailbox sync (enqueues BullMQ job).
   */
  syncMailbox: protectedProcedure
    .input(z.object({ mailAccountId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const account = await db.mailAccount.findFirst({
        where: { id: input.mailAccountId, userId: session.user.id },
      });
      if (!account)
        throw new TRPCError({ code: "NOT_FOUND", message: "Mail account not found" });

      await enqueueSyncJob({
        mailAccountId: input.mailAccountId,
        userId: session.user.id,
        force: true,
      });

      return { queued: true };
    }),

  /**
   * Get a thread with all its messages.
   */
  getThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { session } = ctx;

      const thread = await db.thread.findUnique({
        where: { id: input.threadId },
        include: {
          messages: {
            where: { mailAccount: { userId: session.user.id } },
            orderBy: { receivedAt: "asc" },
            include: {
              messageLabels: { include: { label: true } },
              _count: { select: { attachments: true } },
            },
          },
        },
      });

      if (!thread)
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });

      return thread;
    }),

  /**
   * List threads (grouped message view).
   */
  listThreads: protectedProcedure
    .input(
      z.object({
        ...paginationSchema.shape,
        mailAccountId: z.string().cuid().optional(),
        labelId: z.string().cuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { session } = ctx;
      const { limit, cursor, mailAccountId, labelId } = input;

      const threads = await db.thread.findMany({
        where: {
          messages: {
            some: {
              mailAccount: { userId: session.user.id },
              isDeleted: false,
              ...(mailAccountId ? { mailAccountId } : {}),
              ...(labelId
                ? { messageLabels: { some: { labelId } } }
                : {}),
            },
          },
          ...(cursor
            ? {
                lastMessageAt: {
                  lt:
                    (
                      await db.thread.findUnique({
                        where: { id: cursor },
                        select: { lastMessageAt: true },
                      })
                    )?.lastMessageAt ?? new Date(),
                },
              }
            : {}),
        },
        orderBy: { lastMessageAt: "desc" },
        take: limit + 1,
        include: {
          messages: {
            where: { mailAccount: { userId: session.user.id } },
            orderBy: { receivedAt: "desc" },
            take: 1,
            include: {
              messageLabels: { include: { label: true } },
              _count: { select: { attachments: true } },
            },
          },
        },
      });

      const hasMore = threads.length > limit;
      const items = hasMore ? threads.slice(0, -1) : threads;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return { threads: items, nextCursor, hasMore };
    }),

  /**
   * Full-text search across messages.
   */
  searchMessages: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(500),
        mailAccountId: z.string().cuid().optional(),
        labelId: z.string().cuid().optional(),
        unreadOnly: z.boolean().optional(),
        starredOnly: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { session } = ctx;
      const { query, limit, offset, ...filters } = input;

      const result = await searchMessages(session.user.id, query, {
        limit,
        offset,
        ...filters,
      });

      return result;
    }),
});
