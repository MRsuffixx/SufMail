/**
 * MailForge — Labels tRPC Router
 *
 * CRUD for labels, reordering, and message count per label.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

export const labelsRouter = createTRPCRouter({
  /**
   * List all labels for the current user, ordered by order field.
   */
  list: protectedProcedure
    .input(
      z.object({
        includeMessageCount: z.boolean().default(false),
        mailAccountId: z.string().cuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { session } = ctx;

      const labels = await db.label.findMany({
        where: { userId: session.user.id },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          _count: input.includeMessageCount
            ? {
                select: {
                  messageLabels: {
                    where: {
                      message: {
                        isDeleted: false,
                        ...(input.mailAccountId
                          ? { mailAccountId: input.mailAccountId }
                          : {}),
                      },
                    },
                  },
                },
              }
            : undefined,
        },
      });

      return labels.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
        icon: label.icon,
        isSystem: label.isSystem,
        type: label.type,
        order: label.order,
        messageCount: input.includeMessageCount
          ? (label._count?.messageLabels ?? 0)
          : undefined,
      }));
    }),

  /**
   * Create a custom label.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[^/\\]+$/, "Label name cannot contain slashes"),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        icon: z.string().max(8).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      // Check for name collision
      const existing = await db.label.findFirst({
        where: { userId: session.user.id, name: input.name },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A label named "${input.name}" already exists`,
        });
      }

      // Determine order (append to end)
      const maxOrder = await db.label.aggregate({
        where: { userId: session.user.id },
        _max: { order: true },
      });

      const label = await db.label.create({
        data: {
          userId: session.user.id,
          name: input.name,
          color: input.color ?? null,
          icon: input.icon ?? null,
          isSystem: false,
          type: "CUSTOM",
          order: (maxOrder._max.order ?? -1) + 1,
        },
      });

      return label;
    }),

  /**
   * Update a label (non-system labels only for name changes).
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(100).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional()
          .nullable(),
        icon: z.string().max(8).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const label = await db.label.findFirst({
        where: { id: input.id, userId: session.user.id },
      });

      if (!label)
        throw new TRPCError({ code: "NOT_FOUND", message: "Label not found" });

      // System labels can only have color/icon updated, not name
      if (label.isSystem && input.name) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot rename system labels",
        });
      }

      const updated = await db.label.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
        },
      });

      return updated;
    }),

  /**
   * Delete a custom label (system labels cannot be deleted).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const label = await db.label.findFirst({
        where: { id: input.id, userId: session.user.id },
      });

      if (!label)
        throw new TRPCError({ code: "NOT_FOUND", message: "Label not found" });

      if (label.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System labels cannot be deleted",
        });
      }

      await db.label.delete({ where: { id: input.id } });
      return { deleted: true };
    }),

  /**
   * Reorder labels by providing new order values.
   */
  reorder: protectedProcedure
    .input(
      z.object({
        /** Array of { id, order } pairs */
        items: z.array(
          z.object({
            id: z.string().cuid(),
            order: z.number().int().min(0),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      // Verify all labels belong to user
      const labelIds = input.items.map((i) => i.id);
      const labels = await db.label.findMany({
        where: { id: { in: labelIds }, userId: session.user.id },
        select: { id: true },
      });

      if (labels.length !== labelIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more labels not found",
        });
      }

      await db.$transaction(
        input.items.map(({ id, order }) =>
          db.label.update({ where: { id }, data: { order } }),
        ),
      );

      return { reordered: input.items.length };
    }),

  /**
   * Get unread message count per label.
   */
  getUnreadCounts: protectedProcedure
    .input(z.object({ mailAccountId: z.string().cuid().optional() }))
    .query(async ({ ctx, input }) => {
      const { session } = ctx;

      const counts = await db.messageLabel.groupBy({
        by: ["labelId"],
        where: {
          message: {
            isRead: false,
            isDeleted: false,
            mailAccount: {
              userId: session.user.id,
              ...(input.mailAccountId ? { id: input.mailAccountId } : {}),
            },
          },
          label: { userId: session.user.id },
        },
        _count: { labelId: true },
      });

      return Object.fromEntries(
        counts.map((c) => [c.labelId, c._count.labelId]),
      );
    }),
});
