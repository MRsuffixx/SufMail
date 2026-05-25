/**
 * MailForge — Full-Text Search
 *
 * Provides message search using PostgreSQL tsvector/tsquery (default)
 * or Meilisearch (when configured in config.advanced.searchProvider).
 */

import { db } from "~/server/db";
import { config } from "~/config";
import type { MessageListItem } from "~/types/mail";

export interface SearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter to a specific mail account */
  mailAccountId?: string;
  /** Only include unread messages */
  unreadOnly?: boolean;
  /** Only include starred messages */
  starredOnly?: boolean;
  /** Label ID to filter by */
  labelId?: string;
}

export interface SearchResult {
  messages: MessageListItem[];
  total: number;
}

/**
 * Searches messages for a given user using the configured search provider.
 *
 * @param userId - The authenticated user's ID
 * @param query - The search query string
 * @param options - Additional filter options
 */
export async function searchMessages(
  userId: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const { limit = 50, offset = 0 } = options;
  const provider = config.advanced.searchProvider;

  if (provider === "meilisearch") {
    return searchWithMeilisearch(userId, query, options);
  }

  return searchWithPostgres(userId, query, options, limit, offset);
}

// ─── PostgreSQL Full-Text Search ──────────────────────────────────────────────

async function searchWithPostgres(
  userId: string,
  query: string,
  options: SearchOptions,
  limit: number,
  offset: number,
): Promise<SearchResult> {
  const { mailAccountId, unreadOnly, starredOnly, labelId } = options;

  // Sanitize query for PostgreSQL tsquery
  const sanitizedQuery = query
    .trim()
    .replace(/[^\w\s@.-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" & ");

  if (!sanitizedQuery) {
    return { messages: [], total: 0 };
  }

  // Build WHERE clause conditions
  const conditions: string[] = [
    "ma.\"userId\" = $1",
    "m.\"isDeleted\" = false",
    `(
      to_tsvector('english', coalesce(m.subject, '') || ' ' || coalesce(m."fromEmail", '') || ' ' || coalesce(m."fromName", '') || ' ' || coalesce(m."bodyText", ''))
      @@ plainto_tsquery('english', $2)
    )`,
  ];
  const params: unknown[] = [userId, query];
  let paramIndex = 3;

  if (mailAccountId) {
    conditions.push(`m."mailAccountId" = $${paramIndex}`);
    params.push(mailAccountId);
    paramIndex++;
  }

  if (unreadOnly) {
    conditions.push(`m."isRead" = false`);
  }

  if (starredOnly) {
    conditions.push(`m."isStarred" = true`);
  }

  if (labelId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM "MessageLabel" ml WHERE ml."messageId" = m.id AND ml."labelId" = $${paramIndex})`,
    );
    params.push(labelId);
    paramIndex++;
  }

    const whereClause = conditions.join(" AND ");

  const limitParamIndex = paramIndex;
  const offsetParamIndex = paramIndex + 1;
  const allParams = [...params, limit, offset];

  // Count total
  const countResult = await db.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count
     FROM "Message" m
     JOIN "MailAccount" ma ON m."mailAccountId" = ma.id
     WHERE ${whereClause}`,
    ...allParams,
  );
  const total = Number(countResult[0]?.count ?? 0);

  // Fetch messages
  const rawMessages = await db.$queryRawUnsafe<
    Array<{
      id: string;
      threadId: string | null;
      messageId: string;
      subject: string | null;
      fromEmail: string;
      fromName: string | null;
      snippet: string | null;
      isRead: boolean;
      isStarred: boolean;
      isSnoozed: boolean;
      snoozeUntil: Date | null;
      receivedAt: Date | null;
      sentAt: Date | null;
      attachmentCount: bigint;
    }>
  >(
    `SELECT
       m.id, m."threadId", m."messageId", m.subject, m."fromEmail", m."fromName",
       m.snippet, m."isRead", m."isStarred", m."isSnoozed", m."snoozeUntil",
       m."receivedAt", m."sentAt",
       (SELECT COUNT(*) FROM "Attachment" a WHERE a."messageId" = m.id) as "attachmentCount"
     FROM "Message" m
     JOIN "MailAccount" ma ON m."mailAccountId" = ma.id
     WHERE ${whereClause}
     ORDER BY m."receivedAt" DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
    ...allParams,
  );

  const messages: MessageListItem[] = rawMessages.map((msg) => ({
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
    attachmentCount: Number(msg.attachmentCount),
    labels: [], // Populated separately if needed
  }));

  return { messages, total };
}

// ─── Meilisearch ──────────────────────────────────────────────────────────────

async function searchWithMeilisearch(
  userId: string,
  query: string,
  options: SearchOptions,
): Promise<SearchResult> {
  const { env } = await import("~/env");
  const { MEILISEARCH_HOST, MEILISEARCH_API_KEY } = env;

  if (!MEILISEARCH_HOST) {
    console.warn(
      "[MailForge] Meilisearch not configured, falling back to database search",
    );
    return searchWithPostgres(
      userId,
      query,
      options,
      options.limit ?? 50,
      options.offset ?? 0,
    );
  }

  const url = `${MEILISEARCH_HOST}/indexes/messages/search`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MEILISEARCH_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      q: query,
      filter: `userId = "${userId.replace(/"/g, '\\"')}"`,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Meilisearch error: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    hits: Array<{ id: string }>;
    estimatedTotalHits: number;
  };

  // Fetch full messages from DB using IDs from Meilisearch
  const ids = data.hits.map((h) => h.id);
  const messages = await db.message.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { attachments: true } } },
    orderBy: { receivedAt: "desc" },
  });

  return {
    messages: messages.map((msg) => ({
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
      labels: [],
    })),
    total: data.estimatedTotalHits,
  };
}
