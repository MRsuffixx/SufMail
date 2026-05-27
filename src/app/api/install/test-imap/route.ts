import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import type { TestConnectionResult } from "~/types/install";

export async function POST(req: NextRequest) {
  const { host, port, tls, user, password } = await req.json() as {
    host: string;
    port: number;
    tls: boolean;
    user: string;
    password: string;
  };

  if (!host || !port || !user || !password) {
    return NextResponse.json({ success: false, error: "Missing required fields" } satisfies TestConnectionResult, { status: 400 });
  }

  const client = new ImapFlow({
    host,
    port,
    secure: tls,
    auth: { user, pass: password },
    logger: false,
  });

  const start = Date.now();
  try {
    await client.connect();
    const { capabilities } = await client.listCaps();
    const latencyMs = Date.now() - start;
    await client.logout();
    return NextResponse.json({
      success: true,
      capabilities: Array.from(capabilities ?? []),
      latencyMs,
    } satisfies TestConnectionResult);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ success: false, error } satisfies TestConnectionResult, { status: 400 });
  }
}