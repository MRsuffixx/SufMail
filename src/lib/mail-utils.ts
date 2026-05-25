/**
 * MailForge — Mail Utilities
 *
 * Pure utility functions for email parsing, formatting, and thread management.
 */

import type { EmailAddress } from "~/types/mail";

// ─── Email Address Parsing ────────────────────────────────────────────────────

/**
 * Extracts a plain email address from a potentially formatted string.
 * e.g. "John Doe <john@example.com>" → "john@example.com"
 */
export function extractEmailAddress(raw: string): string {
  const angleMatch = /<([^>]+)>/.exec(raw);
  if (angleMatch?.[1]) return angleMatch[1].trim().toLowerCase();
  return raw.trim().toLowerCase();
}

/**
 * Extracts the display name from a formatted email string.
 * e.g. "John Doe <john@example.com>" → "John Doe"
 */
export function extractDisplayName(raw: string): string | undefined {
  const angleMatch = /^([^<]+)</.exec(raw);
  if (angleMatch?.[1]) {
    return angleMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

/**
 * Parses a raw address string into an EmailAddress object.
 */
export function parseEmailAddress(raw: string): EmailAddress {
  const email = extractEmailAddress(raw);
  const name = extractDisplayName(raw);
  return { email, name };
}

/**
 * Formats an array of EmailAddress objects for display.
 * e.g. [{ name: "John", email: "john@example.com" }] → "John <john@example.com>"
 */
export function formatEmailList(addresses: EmailAddress[]): string {
  return addresses
    .map((addr) =>
      addr.name ? `${addr.name} <${addr.email}>` : addr.email,
    )
    .join(", ");
}

/**
 * Formats a single EmailAddress for display.
 */
export function formatEmailAddress(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

// ─── Message Snippets ─────────────────────────────────────────────────────────

/**
 * Strips HTML tags and extracts a plain-text snippet from an HTML body.
 * Returns at most `maxLength` characters.
 */
export function getMessageSnippet(
  html: string,
  maxLength = 200,
): string {
  // Remove HTML tags
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

// ─── Thread Management ────────────────────────────────────────────────────────

/**
 * Determines if a message is a continuation of an existing thread
 * by checking for In-Reply-To or References headers.
 */
export function isThreadContinuation(
  inReplyTo?: string | null,
  references?: string | null,
): boolean {
  return !!(inReplyTo?.trim() ?? references?.trim());
}

/**
 * Builds a canonical thread ID from References and Message-ID headers.
 *
 * Thread ID is derived from the first Message-ID in the References chain,
 * falling back to the current message ID for new threads.
 */
export function buildThreadId(
  references: string | null | undefined,
  messageId: string,
): string {
  if (!references?.trim()) return normalizeMessageId(messageId);

  // References is a space-separated list of Message-IDs, oldest first
  const refIds = references.trim().split(/\s+/);
  const firstRef = refIds[0];
  if (firstRef) return normalizeMessageId(firstRef);
  return normalizeMessageId(messageId);
}

/**
 * Normalizes a Message-ID by removing angle brackets.
 */
export function normalizeMessageId(messageId: string): string {
  return messageId.replace(/^<|>$/g, "").trim();
}

// ─── Date Utilities ───────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative date label.
 * Used for grouping messages (Today, Yesterday, Last Week, etc.).
 */
export function getDateGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const msgDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
  if (msgDate >= lastWeek) return "This Week";
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString("en-US", { month: "long" });
  }
  return date.getFullYear().toString();
}

// ─── File Utilities ───────────────────────────────────────────────────────────

/**
 * Formats file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Checks if a MIME type is an inline image type.
 */
export function isInlineImageType(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"].includes(
    mimeType.toLowerCase(),
  );
}

// ─── Unsubscribe Detection ────────────────────────────────────────────────────

/**
 * Detects if a message likely has an unsubscribe link.
 * Checks for List-Unsubscribe header and common unsubscribe patterns in body.
 */
export function detectUnsubscribeUrl(
  headers: Record<string, string>,
  bodyText: string,
): string | null {
  // Check List-Unsubscribe header (RFC 2369)
  const listUnsubscribe = headers["list-unsubscribe"] ?? headers["List-Unsubscribe"];
  if (listUnsubscribe) {
    const urlMatch = /https?:\/\/[^\s>]+/.exec(listUnsubscribe);
    if (urlMatch?.[0]) return urlMatch[0];
  }

  // Check body for common unsubscribe patterns
  const patterns = [
    /href="(https?:\/\/[^"]*unsubscribe[^"]*)"/i,
    /href='(https?:\/\/[^']*unsubscribe[^']*)'/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(bodyText);
    if (match?.[1]) return match[1];
  }

  return null;
}
