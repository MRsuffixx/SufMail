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
        search: z.string().optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        includeBlocked: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { session } = ctx;
      const { search, limit, offset, includeBlocked } = input;

      const contacts = await db.contact.findMany({
        where: {
          userId: session.user.id,
          ...(includeBlocked ? {} : { isBlocked: false }),
          ...(search
            ? {
                OR: [
                  { email: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                  { company: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ name: "asc" }, { email: "asc" }],
        take: limit,
        skip: offset,
      });

      const total = await db.contact.count({
        where: {
          userId: session.user.id,
          ...(includeBlocked ? {} : { isBlocked: false }),
          ...(search
            ? {
                OR: [
                  { email: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
      });

      return { contacts, total };
    }),

  /**
   * Get a single contact by ID.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const contact = await db.contact.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!contact)
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      return contact;
    }),

  /**
   * Create a new contact.
   */
  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().max(255).optional(),
        avatar: z.string().url().optional(),
        company: z.string().max(255).optional(),
        phone: z.string().max(50).optional(),
        notes: z.string().max(10000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const existing = await db.contact.findFirst({
        where: { userId: session.user.id, email: input.email.toLowerCase() },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Contact with email ${input.email} already exists`,
        });
      }

      return db.contact.create({
        data: {
          userId: session.user.id,
          email: input.email.toLowerCase(),
          name: input.name ?? null,
          avatar: input.avatar ?? null,
          company: input.company ?? null,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
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
        name: z.string().max(255).optional().nullable(),
        avatar: z.string().url().optional().nullable(),
        company: z.string().max(255).optional().nullable(),
        phone: z.string().max(50).optional().nullable(),
        notes: z.string().max(10000).optional().nullable(),
        isBlocked: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const contact = await db.contact.findFirst({
        where: { id, userId: ctx.session.user.id },
      });

      if (!contact)
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      return db.contact.update({ where: { id }, data });
    }),

  /**
   * Delete a contact.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const contact = await db.contact.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!contact)
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      await db.contact.delete({ where: { id: input.id } });
      return { deleted: true };
    }),

  /**
   * Block or unblock a contact.
   */
  toggleBlock: protectedProcedure
    .input(z.object({ id: z.string().cuid(), isBlocked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const contact = await db.contact.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!contact)
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      return db.contact.update({
        where: { id: input.id },
        data: { isBlocked: input.isBlocked },
      });
    }),

  /**
   * Import contacts from a vCard (VCF) string.
   * Returns counts of imported, skipped (duplicates), and failed.
   */
  importVcf: protectedProcedure
    .input(z.object({ vcfContent: z.string().max(1024 * 1024) }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      const contacts = parseVcf(input.vcfContent);
      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const contact of contacts) {
        try {
          await db.contact.create({
            data: {
              userId: session.user.id,
              email: contact.email.toLowerCase(),
              name: contact.name ?? null,
              phone: contact.phone ?? null,
              company: contact.company ?? null,
            },
          });
          imported++;
        } catch (err) {
          // Check if it's a unique constraint violation (duplicate)
          if (
            err instanceof Error &&
            err.message.includes("Unique constraint")
          ) {
            skipped++;
          } else {
            failed++;
          }
        }
      }

      return { imported, skipped, failed, total: contacts.length };
    }),

  /**
   * Export contacts as vCard (VCF) format.
   */
  exportVcf: protectedProcedure.query(async ({ ctx }) => {
    const contacts = await db.contact.findMany({
      where: { userId: ctx.session.user.id },
    });

    const vcf = contacts
      .map((c) => {
        const lines = ["BEGIN:VCARD", "VERSION:3.0"];
        if (c.name) lines.push(`FN:${c.name}`);
        lines.push(`EMAIL:${c.email}`);
        if (c.phone) lines.push(`TEL:${c.phone}`);
        if (c.company) lines.push(`ORG:${c.company}`);
        if (c.notes) lines.push(`NOTE:${c.notes.replace(/\n/g, "\\n")}`);
        lines.push("END:VCARD");
        return lines.join("\r\n");
      })
      .join("\r\n\r\n");

    return { vcf, count: contacts.length };
  }),

  /**
   * Find and return potential duplicate contacts (same email).
   */
  findDuplicates: protectedProcedure.query(async ({ ctx }) => {
    const contacts = await db.contact.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { email: "asc" },
    });

    const emailMap = new Map<string, typeof contacts>();
    for (const contact of contacts) {
      const key = contact.email.toLowerCase();
      const existing = emailMap.get(key) ?? [];
      existing.push(contact);
      emailMap.set(key, existing);
    }

    const duplicates = Array.from(emailMap.values()).filter(
      (group) => group.length > 1,
    );

    return { duplicateGroups: duplicates, count: duplicates.length };
  }),
});

// ─── VCF Parser ───────────────────────────────────────────────────────────────

interface VcfContact {
  email: string;
  name?: string;
  phone?: string;
  company?: string;
}

function parseVcf(vcf: string): VcfContact[] {
  const contacts: VcfContact[] = [];
  const cards = vcf.split(/BEGIN:VCARD/i).filter((c) => c.trim());

  for (const card of cards) {
    const lines = card.split(/\r?\n/).map((l) => l.trim());
    const contact: Partial<VcfContact> = {};

    for (const line of lines) {
      if (/^EMAIL[;:]/i.test(line)) {
        const match = /:(.+)$/.exec(line);
        if (match?.[1]?.includes("@")) {
          contact.email = match[1].trim().toLowerCase();
        }
      } else if (/^FN:/i.test(line)) {
        contact.name = line.replace(/^FN:/i, "").trim();
      } else if (/^TEL[;:]/i.test(line)) {
        const match = /:(.+)$/.exec(line);
        if (match?.[1]) contact.phone = match[1].trim();
      } else if (/^ORG:/i.test(line)) {
        contact.company = line.replace(/^ORG:/i, "").trim();
      }
    }

    // Only push if email is present and is a valid-looking email address
    if (contact.email && contact.email.includes("@")) {
      contacts.push(contact as VcfContact);
    }
  }

  return contacts;
}
