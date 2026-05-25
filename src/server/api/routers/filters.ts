/**
 * MailForge — Filters tRPC Router
 *
 * CRUD for filter rules, testing rules, and reordering.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import type {
  FilterCondition,
  FilterAction,
  FilterConditionField,
  FilterConditionOperator,
  FilterActionType,
} from "~/types/mail";

// ─── Validation Schemas ───────────────────────────────────────────────────────

const filterConditionSchema = z.object({
  field: z.enum(["from", "to", "subject", "body", "hasAttachment", "size"] satisfies [FilterConditionField, ...FilterConditionField[]]),
  operator: z.enum([
    "contains",
    "notContains",
    "equals",
    "startsWith",
    "endsWith",
    "greaterThan",
    "lessThan",
    "is",
    "isNot",
  ] satisfies [FilterConditionOperator, ...FilterConditionOperator[]]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const filterActionSchema = z.object({
  type: z.enum([
    "addLabel",
    "removeLabel",
    "markRead",
    "markUnread",
    "star",
    "unstar",
    "archive",
    "delete",
    "moveToSpam",
    "forwardTo",
  ] satisfies [FilterActionType, ...FilterActionType[]]),
  value: z.string().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const filtersRouter = createTRPCRouter({
  /**
   * List all filter rules for the current user.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.filterRule.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
  }),

  /**
   * Get a single filter rule.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const rule = await db.filterRule.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!rule)
        throw new TRPCError({ code: "NOT_FOUND", message: "Filter rule not found" });

      return rule;
    }),

  /**
   * Create a new filter rule.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        conditions: z.array(filterConditionSchema).min(1).max(10),
        actions: z.array(filterActionSchema).min(1).max(10),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const maxOrder = await db.filterRule.aggregate({
        where: { userId: session.user.id },
        _max: { order: true },
      });

      return db.filterRule.create({
        data: {
          userId: session.user.id,
          name: input.name,
          conditions: input.conditions,
          actions: input.actions,
          isActive: input.isActive,
          order: (maxOrder._max.order ?? -1) + 1,
        },
      });
    }),

  /**
   * Update a filter rule.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(255).optional(),
        conditions: z.array(filterConditionSchema).min(1).max(10).optional(),
        actions: z.array(filterActionSchema).min(1).max(10).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const rule = await db.filterRule.findFirst({
        where: { id, userId: ctx.session.user.id },
      });

      if (!rule)
        throw new TRPCError({ code: "NOT_FOUND", message: "Filter rule not found" });

      return db.filterRule.update({ where: { id }, data });
    }),

  /**
   * Delete a filter rule.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const rule = await db.filterRule.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!rule)
        throw new TRPCError({ code: "NOT_FOUND", message: "Filter rule not found" });

      await db.filterRule.delete({ where: { id: input.id } });
      return { deleted: true };
    }),

  /**
   * Reorder filter rules.
   */
  reorder: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            id: z.string().cuid(),
            order: z.number().int().min(0),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ruleIds = input.items.map((i) => i.id);
      const rules = await db.filterRule.findMany({
        where: { id: { in: ruleIds }, userId: ctx.session.user.id },
        select: { id: true },
      });

      if (rules.length !== ruleIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more filter rules not found",
        });
      }

      await db.$transaction(
        input.items.map(({ id, order }) =>
          db.filterRule.update({ where: { id }, data: { order } }),
        ),
      );

      return { reordered: input.items.length };
    }),

  /**
   * Test a filter rule against recent messages.
   * Returns messages that would match the rule.
   */
  test: protectedProcedure
    .input(
      z.object({
        conditions: z.array(filterConditionSchema).min(1).max(10),
        mailAccountId: z.string().cuid().optional(),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { session } = ctx;

      // Fetch recent messages to test against
      const messages = await db.message.findMany({
        where: {
          mailAccount: { userId: session.user.id },
          ...(input.mailAccountId ? { mailAccountId: input.mailAccountId } : {}),
          isDeleted: false,
        },
        orderBy: { receivedAt: "desc" },
        take: 500, // Test against recent 500 messages
        select: {
          id: true,
          subject: true,
          fromEmail: true,
          fromName: true,
          toAddresses: true,
          bodyText: true,
          snippet: true,
          receivedAt: true,
          _count: { select: { attachments: true } },
          size: true,
        },
      });

      const matchingMessages = messages
        .filter((msg) => matchesConditions(msg, input.conditions as FilterCondition[]))
        .slice(0, input.limit);

      return {
        matchCount: matchingMessages.length,
        messages: matchingMessages.map((m) => ({
          id: m.id,
          subject: m.subject,
          fromEmail: m.fromEmail,
          snippet: m.snippet,
          receivedAt: m.receivedAt,
        })),
      };
    }),
});

// ─── Filter Matching Logic ────────────────────────────────────────────────────

function matchesConditions(
  message: {
    subject: string | null;
    fromEmail: string;
    fromName: string | null;
    toAddresses: unknown;
    bodyText: string | null;
    _count: { attachments: number };
    size: number;
  },
  conditions: FilterCondition[],
): boolean {
  return conditions.every((condition) => matchesCondition(message, condition));
}

function matchesCondition(
  message: {
    subject: string | null;
    fromEmail: string;
    fromName: string | null;
    toAddresses: unknown;
    bodyText: string | null;
    _count: { attachments: number };
    size: number;
  },
  condition: FilterCondition,
): boolean {
  const { field, operator, value } = condition;

  let fieldValue: string | number | boolean;

  switch (field) {
    case "from":
      fieldValue = `${message.fromName ?? ""} ${message.fromEmail}`.toLowerCase();
      break;
    case "to": {
      const toAddrs = Array.isArray(message.toAddresses)
        ? (message.toAddresses as Array<{ email: string }>)
            .map((a) => a.email)
            .join(" ")
        : "";
      fieldValue = toAddrs.toLowerCase();
      break;
    }
    case "subject":
      fieldValue = (message.subject ?? "").toLowerCase();
      break;
    case "body":
      fieldValue = (message.bodyText ?? "").toLowerCase();
      break;
    case "hasAttachment":
      fieldValue = message._count.attachments > 0;
      break;
    case "size":
      fieldValue = message.size;
      break;
    default:
      return false;
  }

  const strValue = String(value).toLowerCase();
  const numValue = Number(value);
  const fieldStr = String(fieldValue).toLowerCase();
  const fieldNum = Number(fieldValue);

  switch (operator) {
    case "contains":
      return fieldStr.includes(strValue);
    case "notContains":
      return !fieldStr.includes(strValue);
    case "equals":
      return fieldStr === strValue;
    case "startsWith":
      return fieldStr.startsWith(strValue);
    case "endsWith":
      return fieldStr.endsWith(strValue);
    case "greaterThan":
      return fieldNum > numValue;
    case "lessThan":
      return fieldNum < numValue;
    case "is":
      // For strings: compare lowercased; for numbers/booleans: direct comparison
      if (typeof fieldValue === "string") return fieldStr === strValue;
      return fieldValue === value;
    case "isNot":
      if (typeof fieldValue === "string") return fieldStr !== strValue;
      return fieldValue !== value;
    default:
      return false;
  }
}
