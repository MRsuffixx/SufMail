/**
 * Unit tests for ThreadBuilderService.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ThreadBuilderService, normalizeSubject } from "~/server/mail/thread-builder.service";
import { db } from "~/server/db";

// ─── normalizeSubject ─────────────────────────────────────────────────────────

describe("normalizeSubject", () => {
  it("strips Re: prefix", () => {
    expect(normalizeSubject("Re: Hello world")).toBe("hello world");
  });

  it("strips multiple Re: prefixes", () => {
    expect(normalizeSubject("Re: Re: Re: Hello")).toBe("hello");
  });

  it("strips Fwd: prefix", () => {
    expect(normalizeSubject("Fwd: Hello world")).toBe("hello world");
  });

  it("strips Fw: prefix", () => {
    expect(normalizeSubject("Fw: Test subject")).toBe("test subject");
  });

  it("strips Aw: prefix (German)", () => {
    expect(normalizeSubject("Aw: Test subject")).toBe("test subject");
  });

  it("collapses whitespace", () => {
    expect(normalizeSubject("Hello   world")).toBe("hello world");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeSubject("")).toBe("");
  });

  it("handles mixed case prefixes", () => {
    expect(normalizeSubject("RE: FWD: Test")).toBe("test");
  });
});

// ─── extractReferencedIds ─────────────────────────────────────────────────────

describe("ThreadBuilderService.extractReferencedIds", () => {
  it("extracts In-Reply-To", () => {
    const parsed = makeParsedEmail({
      headers: { "in-reply-to": "<msg1@example.com>" },
      references: [],
    });
    const ids = ThreadBuilderService.extractReferencedIds(parsed);
    expect(ids.has("msg1@example.com")).toBe(true);
  });

  it("extracts multiple References", () => {
    const parsed = makeParsedEmail({
      headers: {},
      references: ["<a@x.com>", "<b@x.com>"],
    });
    const ids = ThreadBuilderService.extractReferencedIds(parsed);
    expect(ids.has("a@x.com")).toBe(true);
    expect(ids.has("b@x.com")).toBe(true);
  });

  it("returns empty set when no references", () => {
    const parsed = makeParsedEmail({ headers: {}, references: [] });
    const ids = ThreadBuilderService.extractReferencedIds(parsed);
    expect(ids.size).toBe(0);
  });
});

// ─── findOrCreateThread ───────────────────────────────────────────────────────

describe("ThreadBuilderService.findOrCreateThread", () => {
  const mockAccount = { id: "acc1", userId: "user1" } as Parameters<
    typeof ThreadBuilderService.findOrCreateThread
  >[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds thread by Message-ID reference", async () => {
    const dbMock = vi.mocked(db);
    dbMock.message.findFirst.mockResolvedValueOnce({ threadId: "thread123" } as never);

    const parsed = makeParsedEmail({
      headers: { "in-reply-to": "<original@example.com>" },
      references: [],
    });

    const result = await ThreadBuilderService.findOrCreateThread(mockAccount, parsed);
    expect(result).toBe("thread123");
  });

  it("creates new thread when no match found", async () => {
    const dbMock = vi.mocked(db);
    dbMock.message.findFirst.mockResolvedValue(null);
    dbMock.thread.findMany.mockResolvedValue([]);
    dbMock.thread.create.mockResolvedValueOnce({ id: "newthread" } as never);

    const parsed = makeParsedEmail({ headers: {}, references: [] });
    const result = await ThreadBuilderService.findOrCreateThread(mockAccount, parsed);
    expect(result).toBe("newthread");
    expect(dbMock.thread.create).toHaveBeenCalledOnce();
  });

  it("matches thread by exact normalized subject", async () => {
    const dbMock = vi.mocked(db);
    dbMock.message.findFirst.mockResolvedValue(null);
    dbMock.thread.findMany.mockResolvedValueOnce([
      { id: "subjectthread", subject: "Re: Hello world" },
    ] as never);
    dbMock.thread.update.mockResolvedValueOnce({} as never);

    const parsed = makeParsedEmail({
      subject: "Re: Hello world",
      headers: {},
      references: [],
    });

    const result = await ThreadBuilderService.findOrCreateThread(mockAccount, parsed);
    expect(result).toBe("subjectthread");
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeParsedEmail(
  overrides: Partial<{
    messageId: string;
    subject: string;
    headers: Record<string, string>;
    references: string[];
    date: Date;
    from: { email: string; name?: string };
    to: Array<{ email: string }>;
    cc: Array<{ email: string }>;
    bcc: Array<{ email: string }>;
    bodyText: string;
    bodyHtml: string;
    attachments: unknown[];
    uid: number;
  }>,
) {
  return {
    messageId: overrides.messageId ?? "<test@example.com>",
    subject: overrides.subject ?? "Test Subject",
    headers: overrides.headers ?? {},
    references: overrides.references ?? [],
    date: overrides.date ?? new Date("2025-01-01T00:00:00Z"),
    from: overrides.from ?? { email: "sender@example.com", name: "Sender" },
    to: overrides.to ?? [{ email: "recipient@example.com" }],
    cc: overrides.cc ?? [],
    bcc: overrides.bcc ?? [],
    bodyText: overrides.bodyText ?? "Test body",
    bodyHtml: overrides.bodyHtml ?? "<p>Test body</p>",
    attachments: overrides.attachments ?? [],
    uid: overrides.uid ?? 1001,
  };
}
