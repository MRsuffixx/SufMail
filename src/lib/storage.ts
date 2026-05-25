/**
 * MailForge — Unified Storage Abstraction
 *
 * Wraps S3, Cloudflare R2, and local filesystem storage behind a single interface.
 * Configure the provider in config.ts → config.storage.provider
 */

import { createReadStream, createWriteStream, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "~/config";
import { env } from "~/env";

// ─── S3/R2 Client ─────────────────────────────────────────────────────────────

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3Client) return _s3Client;

  const clientConfig = {
    region: env.STORAGE_REGION ?? config.storage.region ?? "auto",
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY ?? "",
      secretAccessKey: env.STORAGE_SECRET_KEY ?? "",
    },
    ...(env.STORAGE_ENDPOINT
      ? { endpoint: env.STORAGE_ENDPOINT, forcePathStyle: true }
      : {}),
  };

  _s3Client = new S3Client(clientConfig);
  return _s3Client;
}

function getBucket(): string {
  return env.STORAGE_BUCKET ?? config.storage.bucket;
}

// ─── Local Storage Helpers ────────────────────────────────────────────────────

const LOCAL_UPLOADS_DIR = join(process.cwd(), "public", "uploads");

function ensureLocalDir(key: string): string {
  const filePath = join(LOCAL_UPLOADS_DIR, key);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return filePath;
}

// ─── Public Interface ─────────────────────────────────────────────────────────

/**
 * Uploads a file buffer to the configured storage provider.
 *
 * @param buffer - File content as a Buffer
 * @param key - Storage key / path (e.g. "attachments/user123/file.pdf")
 * @param mimeType - MIME type of the file
 * @returns The storage key
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  mimeType: string,
): Promise<string> {
  const provider = config.storage.provider;

  if (provider === "s3" || provider === "r2") {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return key;
  }

  // Local filesystem
  const filePath = ensureLocalDir(key);
  await pipeline(Readable.from(buffer), createWriteStream(filePath));
  return key;
}

/**
 * Returns a signed URL for accessing a file.
 * For local storage, returns a public URL path.
 *
 * @param key - Storage key
 * @param expiresIn - URL expiration in seconds (default: 3600)
 */
export async function getSignedUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const provider = config.storage.provider;

  if (provider === "s3" || provider === "r2") {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    });
    return awsGetSignedUrl(client, command, { expiresIn });
  }

  // Local: return public URL
  const publicUrl = env.NEXT_PUBLIC_STORAGE_PUBLIC_URL ?? config.storage.publicUrl;
  return `${publicUrl}/${key}`;
}

/**
 * Deletes a file from storage.
 *
 * @param key - Storage key
 */
export async function deleteFile(key: string): Promise<void> {
  const provider = config.storage.provider;

  if (provider === "s3" || provider === "r2") {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );
    return;
  }

  // Local: delete the file
  const filePath = join(LOCAL_UPLOADS_DIR, key);
  if (existsSync(filePath)) {
    const { unlink } = await import("fs/promises");
    await unlink(filePath);
  }
}

/**
 * Generates a storage key for an attachment.
 */
export function generateAttachmentKey(
  userId: string,
  messageId: string,
  filename: string,
): string {
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `attachments/${userId}/${messageId}/${timestamp}-${safeName}`;
}

/**
 * Generates a storage key for a raw email message.
 */
export function generateRawMessageKey(
  mailAccountId: string,
  messageId: string,
): string {
  const safeMsgId = messageId.replace(/[^a-zA-Z0-9]/g, "_");
  return `raw/${mailAccountId}/${safeMsgId}.eml`;
}

// Suppress the unused import warning for createReadStream
void createReadStream;
