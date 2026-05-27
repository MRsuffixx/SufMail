import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type { TestConnectionResult } from "~/types/install";

export async function POST(req: NextRequest) {
  const { host, port, secure, user, password } = await req.json() as {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };

  if (!host || !port || !user || !password) {
    return NextResponse.json({ success: false, error: "Missing required fields" } satisfies TestConnectionResult, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
    connectionTimeout: 10000,
  });

  const start = Date.now();
  try {
    await transporter.verify();
    const latencyMs = Date.now() - start;
    return NextResponse.json({ success: true, latencyMs } satisfies TestConnectionResult);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ success: false, error } satisfies TestConnectionResult, { status: 400 });
  }
}