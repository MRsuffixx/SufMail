import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { getRedisConnection } from "~/server/queue/client";
import { existsSync } from "fs";
import { join } from "path";
import type { Queue } from "bullmq";

function isInstalled(): boolean {
  if (process.env.INSTALL_COMPLETE === "true") return true;
  return existsSync(join(process.cwd(), "install.lock"));
}

export async function GET() {
  const start = Date.now();
  const installed = isInstalled();

  let dbStatus: "ok" | "error" = "error";
  let dbLatency = 0;

  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - t0;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  let redisStatus: "ok" | "error" = "error";
  let redisLatency = 0;
  let queueStatus: "ok" | "error" = "error";
  let pendingJobs = 0;

  try {
    const redis = getRedisConnection();
    const t0 = Date.now();
    await redis.ping();
    redisLatency = Date.now() - t0;
    redisStatus = "ok";

    let queue: Queue | null = null;
    try {
      const { default: BullMQ } = await import("bullmq");
      queue = new BullMQ("mail:sync", { connection: redis });
      const counts = await queue.getJobCounts("waiting", "delayed");
      pendingJobs = (counts.waiting ?? 0) + (counts.delayed ?? 0);
      queueStatus = "ok";
    } catch {
      queueStatus = "error";
    } finally {
      if (queue) {
        await queue.close().catch(() => {});
      }
    }
  } catch {
    redisStatus = "error";
  }

  const allOk = dbStatus === "ok" && redisStatus === "ok" && queueStatus === "ok";
  const degraded = !allOk && dbStatus === "ok";

  const { default: packageJson } = await import("../../../../package.json" as string).catch(() => ({ default: { version: "0.0.0" } }));

  return NextResponse.json({
    status: allOk ? "ok" : degraded ? "degraded" : "down",
    version: (packageJson as { version: string }).version ?? "0.0.0",
    installed,
    services: {
      database: { status: dbStatus, latencyMs: dbLatency },
      redis: { status: redisStatus, latencyMs: redisLatency },
      queue: { status: queueStatus, pendingJobs },
    },
    uptime: Math.floor((Date.now() - start) / 1000),
    timestamp: new Date().toISOString(),
  });
}