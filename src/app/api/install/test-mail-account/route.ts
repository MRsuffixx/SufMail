import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import type { TestMailAccountResult } from "~/types/install";

export async function POST(req: NextRequest) {
  const {
    email,
    imap,
    smtp,
  } = await req.json() as {
    email: string;
    imap: { host: string; port: number; tls: boolean; user: string; password: string };
    smtp: { host: string; port: number; secure: boolean; user: string; password: string };
  };

  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.tls,
    auth: { user: imap.user, pass: imap.password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const latest = await client.fetchOne(client.mailbox.existence ? -1 : 1, { envelope: true, internalDate: true });
      await client.logout();
      return NextResponse.json({
        success: true,
        subject: (latest as { envelope?: { subject?: string } })?.envelope?.subject ?? "(no subject)",
        from: (latest as { envelope?: { from?: Array<{ address?: string }> } })?.envelope?.from?.[0]?.address ?? "",
        date: (latest as { internalDate?: Date })?.internalDate?.toISOString() ?? "",
      } satisfies TestMailAccountResult);
    } finally {
      lock.release();
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ success: false, error } satisfies TestMailAccountResult, { status: 400 });
  }
}