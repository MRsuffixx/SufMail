/**
 * MailForge — Prometheus Metrics API Endpoint
 *
 * Exposes application metrics in Prometheus text format.
 * Optionally restricted to specific IPs via METRICS_ALLOWED_IPS env var.
 */

import { type NextRequest, NextResponse } from "next/server";
import { metricsRegistry } from "~/server/observability/metrics.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Optional IP restriction
  const allowedIps = process.env.METRICS_ALLOWED_IPS;
  if (allowedIps) {
    const allowed = allowedIps.split(",").map((ip) => ip.trim());
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (!allowed.includes(clientIp)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  try {
    const metrics = await metricsRegistry.metrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        "Content-Type": metricsRegistry.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[Metrics] Failed to collect metrics:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
