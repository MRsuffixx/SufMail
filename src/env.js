import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables schema.
   * These will never be exposed to the browser.
   */
  server: {
    // ── Core ──────────────────────────────────────────────────────────────
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: z.string().min(1),

    // ── Auth ──────────────────────────────────────────────────────────────
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(32)
        : z.string().min(32).optional(),
    AUTH_URL: z.string().url().optional(),

    // ── OAuth Providers (all optional — enabled via config.auth.providers) ─
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_CLIENT_ID: z.string().optional(),
    MICROSOFT_CLIENT_SECRET: z.string().optional(),

    // ── Email (Magic Link provider) ───────────────────────────────────────
    EMAIL_SERVER_HOST: z.string().optional(),
    EMAIL_SERVER_PORT: z.coerce.number().optional(),
    EMAIL_SERVER_USER: z.string().optional(),
    EMAIL_SERVER_PASSWORD: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // ── Redis ─────────────────────────────────────────────────────────────
    REDIS_URL: z.string().url().optional(),

    // ── Storage (S3 / R2 / local) ─────────────────────────────────────────
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_REGION: z.string().optional(),
    STORAGE_ENDPOINT: z.string().url().optional(),

    // ── Encryption ────────────────────────────────────────────────────────
    // Must be a 64-char hex string (32 bytes for AES-256-GCM)
    ENCRYPTION_KEY: z.string().length(64).optional(),
    // Active key version (1 = ENCRYPTION_KEY, higher = ENCRYPTION_KEY_V<n>)
    ENCRYPTION_KEY_VERSION: z.coerce.number().int().min(1).default(1),

    // ── Search ────────────────────────────────────────────────────────────
    MEILISEARCH_HOST: z.string().url().optional(),
    MEILISEARCH_API_KEY: z.string().optional(),

    // ── Observability ─────────────────────────────────────────────────────
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    METRICS_ALLOWED_IPS: z.string().optional(),
  },

  /**
   * Client-side environment variables schema.
   * Must be prefixed with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_STORAGE_PUBLIC_URL: z.string().optional(),
  },

  /**
   * Manually destructure all env vars here so Next.js can find them.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
    EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
    EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
    EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
    EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
    REDIS_URL: process.env.REDIS_URL,
    STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
    STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
    STORAGE_BUCKET: process.env.STORAGE_BUCKET,
    STORAGE_REGION: process.env.STORAGE_REGION,
    STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    ENCRYPTION_KEY_VERSION: process.env.ENCRYPTION_KEY_VERSION,
    MEILISEARCH_HOST: process.env.MEILISEARCH_HOST,
    MEILISEARCH_API_KEY: process.env.MEILISEARCH_API_KEY,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    METRICS_ALLOWED_IPS: process.env.METRICS_ALLOWED_IPS,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STORAGE_PUBLIC_URL: process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL,
  },

  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
   * Useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Empty strings are treated as undefined.
   */
  emptyStringAsUndefined: true,
});
