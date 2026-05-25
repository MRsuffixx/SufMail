/**
 * MailForge — Email Parser
 *
 * Parses raw RFC 2822 email messages into structured ParsedEmail objects.
 * Uses mailparser for parsing and DOMPurify for HTML sanitization.
 */

import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import type { ParsedEmail, ParsedAttachment, EmailAddress } from "~/types/mail";
import { normalizeMessageId } from "~/lib/mail-utils";

// Create a single JSDOM window and DOMPurify instance once at module load.
// Creating new JSDOM instances on every call is expensive; a singleton is safe
// here because DOMPurify is stateless between calls.
const _domPurifyInstance = DOMPurify(new JSDOM("").window as unknown as Window);

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Allows safe email HTML while stripping dangerous elements.
 */
export function sanitizeHtml(html: string): string {
  const purify = _domPurifyInstance;

  return purify.sanitize(html, {
    ALLOWED_TAGS: [
      "a", "abbr", "acronym", "address", "article", "aside",
      "b", "bdo", "blockquote", "br", "caption", "cite", "code",
      "col", "colgroup", "dd", "del", "dfn", "div", "dl", "dt",
      "em", "figure", "figcaption", "footer", "h1", "h2", "h3",
      "h4", "h5", "h6", "header", "hr", "i", "img", "ins", "kbd",
      "li", "main", "mark", "nav", "ol", "p", "pre", "q", "s",
      "samp", "section", "small", "span", "strong", "sub", "sup",
      "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr",
      "u", "ul", "var",
    ],
    ALLOWED_ATTR: [
      "alt", "class", "colspan", "dir", "height", "href", "id",
      "lang", "rowspan", "src", "style", "target", "title", "width",
    ],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
    // Force links to open in new tab safely
    RETURN_DOM_FRAGMENT: false,
  });
}

// ─── Address Normalization ────────────────────────────────────────────────────

function normalizeAddresses(
  address: AddressObject | AddressObject[] | undefined,
): EmailAddress[] {
  if (!address) return [];
  const addrs = Array.isArray(address) ? address : [address];
  const result: EmailAddress[] = [];

  for (const addr of addrs) {
    for (const val of addr.value) {
      if (val.address) {
        result.push({
          email: val.address.toLowerCase(),
          name: val.name ?? undefined,
        });
      }
    }
  }

  return result;
}

// ─── References Parsing ───────────────────────────────────────────────────────

function parseReferences(parsed: ParsedMail): string[] {
  const raw = parsed.references;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(normalizeMessageId);
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeMessageId);
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

/**
 * Parses a raw RFC 2822 email string or Buffer into a structured ParsedEmail.
 *
 * @param raw - The raw email content (string or Buffer)
 * @param uid - Optional IMAP UID for the message
 * @param mailbox - Optional IMAP mailbox name
 */
export async function parseRawEmail(
  raw: string | Buffer,
  uid?: number,
  mailbox?: string,
): Promise<ParsedEmail> {
  const parsed = await simpleParser(raw, {
    skipHtmlToText: false,
    skipTextToHtml: false,
    skipImageLinks: false,
  });

  const fromAddresses = normalizeAddresses(parsed.from);
  const from: EmailAddress = fromAddresses[0] ?? {
    email: "unknown@unknown.com",
    name: undefined,
  };

  const messageId = parsed.messageId
    ? normalizeMessageId(parsed.messageId)
    : `generated-${Date.now()}`;

  // Sanitize HTML body
  const rawHtml = parsed.html ?? parsed.textAsHtml ?? "";
  const bodyHtml = rawHtml ? sanitizeHtml(rawHtml) : "";
  const bodyText = parsed.text ?? "";

  // Process attachments
  const attachments: ParsedAttachment[] = (parsed.attachments ?? [])
    .filter((a) => a.content instanceof Buffer && a.content.length > 0)
    .map((a) => ({
      filename: a.filename ?? "attachment",
      mimeType: a.contentType ?? "application/octet-stream",
      size: a.size ?? a.content.length,
      content: a.content as Buffer,
      contentId: a.contentId ?? undefined,
      isInline: a.contentDisposition === "inline",
    }));

  // Extract headers as plain object
  const headers: Record<string, string> = {};
  if (parsed.headers) {
    parsed.headers.forEach((value, key) => {
      headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
    });
  }

  const inReplyTo = parsed.inReplyTo
    ? normalizeMessageId(parsed.inReplyTo)
    : undefined;

  return {
    messageId,
    subject: parsed.subject ?? "(no subject)",
    from,
    to: normalizeAddresses(parsed.to),
    cc: normalizeAddresses(parsed.cc),
    bcc: normalizeAddresses(parsed.bcc),
    replyTo: normalizeAddresses(parsed.replyTo)[0] ?? undefined,
    inReplyTo,
    references: parseReferences(parsed),
    bodyHtml,
    bodyText,
    attachments,
    headers,
    date: parsed.date ?? undefined,
    uid,
    mailbox,
  };
}
