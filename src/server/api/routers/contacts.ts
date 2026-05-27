/**
 * MailForge — Contacts tRPC Router
 *
 * Address book management: CRUD, import from VCF, export, deduplication.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

export const contactsRouter = createTRPCRouter({
  /**
   * List contacts with optional search.
   */
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(100).default(50),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { session } = ctx;
      const { cursor, limit, search } = input;

      const where: Record<string, unknown> = {
        userId: session.user.id,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const contacts = await db.contact.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      const hasMore = contacts.length > limit;
      const items = hasMore ? contacts.slice(0, -1) : contacts;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  /**
   * Get a single contact by ID.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const { session } = ctx;
      const contact = await db.contact.findUnique({
        where: { id: input.id },
      });

      if (!contact || contact.userId !== session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return contact;
    }),

  /**
   * Create a new contact.
   */
  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        company: z.string().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      return db.contact.create({
        data: {
          ...input,
          userId: session.user.id,
        },
      });
    }),

  /**
   * Update a contact.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        company: z.string().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
        isBlocked: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      const { id, ...data } = input;

      const existing = await db.contact.findUnique({ where: { id } });
      if (!existing || existing.userId !== session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return db.contact.update({ where: { id }, data });
    }),

  /**
   * Delete a contact.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const existing = await db.contact.findUnique({ where: { id: input.id } });
      if (!existing || existing.userId !== session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.contact.delete({ where: { id: input.id } });
      return { deleted: true };
    }),

  /**
   * Import contacts from a VCF (vCard) file.
   */
  importVcf: protectedProcedure
    .input(
      z.object({
        vcfContent: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      let imported = 0;
      let skipped = 0;
      let failed = 0;

      const vcards = parseVcf(input.vcfContent);

      for (const c of vcards) {
        try {
          await db.contact.create({
            data: {
              userId: session.user.id,
              email: c.email,
              name: c.name ?? null,
              company: c.company ?? null,
              phone: c.phone ?? null,
              notes: c.notes?.replace(/\n/g, "\\n") ?? null,
            },
          });
          imported++;
        } catch (err) {
          const prismaErr = err as Record<string, unknown>;
          if (prismaErr.code === "P2002") {
            skipped++;
          } else {
            failed++;
          }
        }
      }

      return { imported, skipped, failed, total: vcards.length };
    }),

  /**
   * Export contacts as VCF.
   */
  exportVcf: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const contacts = await db.contact.findMany({
        where: {
          userId: session.user.id,
          ...(input.ids?.length ? { id: { in: input.ids } } : {}),
        },
        orderBy: { name: "asc" },
      });

      return contacts.map((c) => formatVCard(c)).join("\r\n");
    }),
});

function parseVcf(vcf: string) {
  const contacts: Array<{
    email: string;
    name?: string;
    company?: string;
    phone?: string;
    notes?: string;
  }> = [];

  const vcards = vcf.split(/(?=BEGIN:VCARD)/i);
  for (const card of vcards) {
    if (!card.trim()) continue;

    const emailMatch = /EMAIL[;:][^:\r\n]+/i.exec(card);
    const nameMatch = /FN[;:][^:\r\n]+/i.exec(card);
    const orgMatch = /ORG[;:][^:\r\n]+/i.exec(card);
    const telMatch = /TEL[;:][^:\r\n]+/i.exec(card);
    const noteMatch = /NOTE[;:][^:\r\n]+/i.exec(card);

    if (emailMatch) {
      const email = emailMatch[0]!.replace(/EMAIL[;:]/i, "").trim();
      const name = nameMatch ? nameMatch[0]!.replace(/FN[;:]/i, "").trim() : undefined;
      const company = orgMatch ? orgMatch[0]!.replace(/ORG[;:]/i, "").trim() : undefined;
      const phone = telMatch ? telMatch[0]!.replace(/TEL[;:]/i, "").trim() : undefined;
      const notes = noteMatch ? noteMatch[0]!.replace(/NOTE[;:]/i, "").trim() : undefined;

      contacts.push({ email, name, company, phone, notes });
    }
  }

  return contacts;
}

function formatVCard(c: {
  email: string;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  notes?: string | null;
}): string {
  // Escape special characters per RFC 6328: backslash, newline, comma, semicolon
  const escapeVCard = (str: string): string => {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  };

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${c.name ?? c.email}`,
    `EMAIL:${c.email}`,
  ];

  if (c.company) lines.push(`ORG:${escapeVCard(c.company)}`);
  if (c.phone) lines.push(`TEL:${escapeVCard(c.phone)}`);
  if (c.notes) lines.push(`NOTE:${escapeVCard(c.notes)}`);

  lines.push("END:VCARD");
  return lines.join("\r\n");
}
