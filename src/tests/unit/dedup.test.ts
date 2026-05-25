/**
 * Unit tests for DeduplicationService.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeduplicationService } from "~/server/mail/dedup.service";
import { db } from "~/server/db";

describe("DeduplicationService.computeMessageHash", () => {
  it("returns a 64-char hex SHA-256 hash", () => {
    const parsed = makeParsedEmail({});
    const hash = DeduplicationService.computeMessageHash(parsed);
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it("same message produces same hash", () => {
    const parsed = makeParsedEmail({});
    expect(DeduplicationService.computeMessageHash(parsed)).toBe(
      DeduplicationService.computeMessageHash(parsed),
    );
  });

  it("different fromEmail produces different hash", () => {
    const a = makeParsedEmail({ from: { email: "a@x.com" } });
    const b = makeParsedEmail({ from: { email: "b@x.com" } });
    expect(DeduplicationService.computeMessageHash(a)).not.toBe(
      DeduplicationService.computeMessageHash(b),
    );
  });
});

describe("DeduplicationService.generateIdempotencyKey", () => {
  it("returns a 64-char hex string", () => {
    const key = DeduplicationService.generateIdempotencyKey("acc1", 1234, "INBOX");
    expect(key).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(key)).toBe(true);
  });

  it("same inputs produce same key", () => {
    expect(DeduplicationService.generateIdempotencyKey("acc1", 1234, "INBOX")).toBe(
      DeduplicationService.generateIdempotencyKey("acc1", 1234, "INBOX"),
    );
  });

  it("different UIDs produce different keys", () => {
    expect(DeduplicationService.generateIdempotencyKey("acc1", 1, "INBOX")).not.toBe(
      DeduplicationService.generateIdempotencyKey("acc1", 2, "INBOX"),
    );
  });
});

describe("DeduplicationService.isDuplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when message ID already exists", async () => {
    const dbMock = vi.mocked(db);
    dbMock.message.findFirst.mockResolvedValueOnce({ id: "existing" } as never);

    const result = await DeduplicationService.isDuplicate(
      "acc1",
      makeParsedEmail({}),
    );
    expect(result).toBe(true);
  });

  it("returns false when no duplicate found", async () => {
    const dbMock = vi.mocked(db);
    dbMock.message.findFirst.mockResolvedValue(null);

    const result = await DeduplicationService.isDuplicate(
      "acc1",
      makeParsedEmail({}),
    );
    expect(result).toBe(false);
  });

  it("checks content hash as fallback", async () => {
    const dbMock = vi.mocked(db);
    // First call (messageId check) returns null
    dbMock.message.findFirst
      .mockResolvedValueOnce(null)
      // Second call (hash check) returns duplicate
      .mockResolvedValueOnce({ id: "dup" } as never);

    const result = await DeduplicationService.isDuplicate(
      "acc1",
      makeParsedEmail({}),
    );
    expect(result).toBe(true);
    expect(dbMock.message.findFirst).toHaveBeenCalledTimes(2);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeParsedEmail(overrides: Partial<{
  messageId: string;
  from: { email: string; name?: string };
  date: Date;
  bodyText: string;
}>) {
  return {
    messageId: overrides.messageId ?? "<test@example.com>",
    from: overrides.from ?? { email: "sender@example.com" },
    date: overrides.date ?? new Date("2025-01-01T00:00:00Z"),
    bodyText: overrides.bodyText ?? "Hello world",
    subject: "Test",
    headers: {},
    references: [],
    to: [],
    cc: [],
    bcc: [],
    bodyHtml: null,
    attachments: [],
    uid: 1001,
  };
}
