import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../../../../generated/prisma";
import type { TestDbResult } from "~/types/install";

export async function POST(req: NextRequest) {
  const { connectionString } = await req.json() as { connectionString: string };

  if (!connectionString) {
    return NextResponse.json({ success: false, error: "Connection string required" } satisfies TestDbResult, { status: 400 });
  }

  const start = Date.now();
  const tempDb = new PrismaClient({
    datasources: { db: { url: connectionString } },
    log: [],
  });

  try {
    await tempDb.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    await tempDb.$disconnect();
    return NextResponse.json({ success: true, latencyMs } satisfies TestDbResult);
  } catch (err) {
    await tempDb.$disconnect().catch(() => {});
    const error = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ success: false, error } satisfies TestDbResult, { status: 400 });
  }
}