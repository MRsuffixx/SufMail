/**
 * MailForge — Thread Builder Service
 *
 * RFC 2822-compliant email threading engine.
 * Priority: Message-ID graph → fuzzy subject match → new thread.
 */

import { db } from "~/server/db";
import type { ParsedEmail } from "~/types/mail";
import type { MailAccount } from "../../../generated/prisma";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalizes an email subject for fuzzy matching:
 * strips Re:/Fwd:/Aw: prefixes, lowercases, collapses whitespace.
 */
export function normalizeSubject(subject: string): string {
  let result = subject.trim();
  const prefixRe = /^(re|fwd|fw|aw|wg|ref|sv|rv)\s*:\s*/i;
  // Strip all leading prefixes iteratively
  let prev: string;
  do {
    prev = result;
    result = result.replace(prefixRe, "");
  } while (result !== prev);
  return result.toLowerCase().replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

// ─── Thread Builder Service ───────────────────────────────────────────────────

export class ThreadBuilderService {
  /**
   * Finds an existing thread or creates a new one for a parsed email.
   *
   * Strategy (priority order):
   * 1. Direct match via In-Reply-To / References Message-IDs
   * 2. Fuzzy subject match (within 30 days)
   * 3. Create new thread
   */
  static async findOrCreateThread(
    account: MailAccount,
    parsed: ParsedEmail,
  ): Promise<string> {
    const referencedIds = ThreadBuilderService.extractReferencedIds(parsed);

    // 1. Message-ID graph lookup
    if (referencedIds.size > 0) {
      const existingMsg = await db.message.findFirst({
        where: {
          messageId: { in: Array.from(referencedIds) },
          mailAccountId: account.id,
        },
        select: { threadId: true },
      });
      if (existingMsg?.threadId) {
        await ThreadBuilderService.updateThread(existingMsg.threadId, parsed);
        return existingMsg.threadId;
      }
    }

    // 2. Fuzzy subject match
    const subjectThreadId = await ThreadBuilderService.findBySubject(
      account.id,
      parsed.subject,
      parsed.date ?? new Date(),
    );
    if (subjectThreadId) {
      await ThreadBuilderService.updateThread(subjectThreadId, parsed);
      return subjectThreadId;
    }

    // 3. New thread
    return ThreadBuilderService.createThread(parsed);
  }

  /**
   * Extracts referenced Message-IDs from In-Reply-To and References headers.
   */
  static extractReferencedIds(parsed: ParsedEmail): Set<string> {
    const ids = new Set<string>();

    const inReplyTo =
      parsed.headers["in-reply-to"] ?? parsed.headers["In-Reply-To"];
    if (inReplyTo) {
      const id = ThreadBuilderService.extractMessageId(inReplyTo);
      if (id) ids.add(id);
    }

    for (const ref of parsed.references) {
      const id = ThreadBuilderService.extractMessageId(ref);
      if (id) ids.add(id);
    }

    return ids;
  }

  private static extractMessageId(raw: string): string | null {
    const match = /<([^>]+)>/.exec(raw) ?? /([\S]+@[\S]+)/.exec(raw);
    return match?.[1]?.trim() ?? null;
  }

  private static async findBySubject(
    mailAccountId: string,
    subject: string,
    date: Date,
  ): Promise<string | null> {
    if (!subject.trim()) return null;
    const normalizedIncoming = normalizeSubject(subject);
    if (!normalizedIncoming) return null;

    const thirtyDaysAgo = new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);

    const threads = await db.thread.findMany({
      where: {
        lastMessageAt: { gte: thirtyDaysAgo },
        messages: { some: { mailAccountId } },
      },
      select: { id: true, subject: true },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    });

    for (const thread of threads) {
      const normalized = normalizeSubject(thread.subject);
      if (!normalized) continue;
      if (normalized === normalizedIncoming) return thread.id;
      if (
        normalizedIncoming.length > 5 &&
        normalized.length > 5 &&
        levenshtein(normalized, normalizedIncoming) <= 2
      ) {
        return thread.id;
      }
    }
    return null;
  }

  private static async createThread(parsed: ParsedEmail): Promise<string> {
    const thread = await db.thread.create({
      data: {
        subject: parsed.subject,
        participantEmails: JSON.stringify([parsed.from.email]),
        messageCount: 1,
        unreadCount: 1,
        lastMessageAt: parsed.date ?? new Date(),
        labelIds: JSON.stringify([]),
      },
    });
    return thread.id;
  }

  private static async updateThread(
    threadId: string,
    parsed: ParsedEmail,
  ): Promise<void> {
    const thread = await db.thread.findUnique({
      where: { id: threadId },
      select: { participantEmails: true, lastMessageAt: true },
    });
    if (!thread) return;

    let participants: string[] = [];
    try {
      participants = JSON.parse(thread.participantEmails as string) as string[];
    } catch {
      participants = [];
    }
    if (!participants.includes(parsed.from.email)) {
      participants.push(parsed.from.email);
    }

    const newDate = parsed.date ?? new Date();
    const lastMessageAt =
      newDate > (thread.lastMessageAt ?? new Date(0))
        ? newDate
        : thread.lastMessageAt;

    await db.thread.update({
      where: { id: threadId },
      data: {
        participantEmails: JSON.stringify(participants),
        lastMessageAt,
        messageCount: { increment: 1 },
        unreadCount: { increment: 1 },
      },
    });
  }
}
