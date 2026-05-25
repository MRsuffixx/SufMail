/**
 * MailForge — OpenTelemetry Tracing
 *
 * Sets up OpenTelemetry SDK with OTLP exporter (optional).
 * Must be initialized before any other imports in worker.ts.
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { logger } from "~/lib/logger";

let sdk: NodeSDK | null = null;

/**
 * Initializes the OpenTelemetry SDK.
 * Call this once at the start of worker.ts before importing any instrumented modules.
 */
export function initTracing(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const isDev = process.env.NODE_ENV === "development";

  const spanProcessors = endpoint
    ? [new SimpleSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }))]
    : isDev
      ? [new SimpleSpanProcessor(new ConsoleSpanExporter())]
      : [];

  if (spanProcessors.length === 0) {
    logger.info("[Tracing] No OTEL exporter configured — tracing disabled");
    return;
  }

  sdk = new NodeSDK({
    serviceName: "mailforge",
    spanProcessors,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  sdk.start();

  logger.info(
    { endpoint: endpoint ?? "console" },
    "[Tracing] OpenTelemetry initialized",
  );
}

/**
 * Gracefully shuts down the OpenTelemetry SDK.
 */
export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
    logger.info("[Tracing] OpenTelemetry shut down");
  } catch (err) {
    logger.error({ err }, "[Tracing] Error during shutdown");
  }
}
