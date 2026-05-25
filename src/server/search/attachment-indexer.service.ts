/**
 * MailForge — Attachment Indexer Service
 *
 * Extracts searchable text content from email attachments
 * (PDFs, plain text files) and stores it in Attachment.textContent
 * for full-text search indexing.
 */

import { db } from "~/server/db";
import { getFile } from "~/lib/storage";
import { syncLogger } from "~/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

const INDEXABLE_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/html",
  "text/xml",
  "application/json",
]);

const MAX_TEXT_CONTENT_LENGTH = 50_000; // Characters

// ─── Attachment Indexer ───────────────────────────────────────────────────────

export class AttachmentIndexerService {
  /**
   * Extracts text content from an attachment and stores it in the DB.
   * Silently skips unsupported MIME types.
   */
  static async indexAttachment(attachmentId: string): Promise<void> {
    const attachment = await db.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        storageKey: true,
        textContent: true,
      },
    });

    if (!attachment) return;
    if (attachment.textContent) return; // Already indexed
    if (!INDEXABLE_MIME_TYPES.has(attachment.mimeType)) return;

    try {
      const content = await AttachmentIndexerService.extractText(attachment);
      if (content) {
        await db.attachment.update({
          where: { id: attachmentId },
          data: { textContent: content.slice(0, MAX_TEXT_CONTENT_LENGTH) },
        });
        syncLogger.debug(
          { attachmentId, filename: attachment.filename, chars: content.length },
          "[Indexer] Attachment text indexed",
        );
      }
    } catch (err) {
      syncLogger.warn(
        { attachmentId, filename: attachment.filename, err },
        "[Indexer] Failed to index attachment",
      );
    }
  }

  /**
   * Extracts text from an attachment's stored content.
   */
  private static async extractText(attachment: {
    storageKey: string;
    mimeType: string;
    filename: string;
  }): Promise<string | null> {
    const buffer = await getFile(attachment.storageKey);
    if (!buffer) return null;

    if (attachment.mimeType === "application/pdf") {
      return AttachmentIndexerService.extractPdfText(buffer);
    }

    if (
      attachment.mimeType.startsWith("text/") ||
      attachment.mimeType === "application/json"
    ) {
      return buffer.toString("utf-8");
    }

    return null;
  }

  /**
   * Extracts text from a PDF buffer using pdf-parse.
   */
  private static async extractPdfText(buffer: Buffer): Promise<string | null> {
    try {
      // Dynamic import to avoid loading pdf-parse at startup
      const pdfParse = await import("pdf-parse").then((m) => m.default ?? m);
      const data = await pdfParse(buffer);
      return data.text ?? null;
    } catch (err) {
      syncLogger.warn({ err }, "[Indexer] PDF parse failed");
      return null;
    }
  }

  /**
   * Indexes all unindexed attachments for a message.
   */
  static async indexMessageAttachments(messageId: string): Promise<void> {
    const attachments = await db.attachment.findMany({
      where: { messageId, textContent: null },
      select: { id: true },
    });

    await Promise.allSettled(
      attachments.map((a) => AttachmentIndexerService.indexAttachment(a.id)),
    );
  }
}
