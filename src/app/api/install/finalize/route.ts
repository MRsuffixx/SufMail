import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import bcryptjs from "bcryptjs";
import { PrismaClient } from "../../../../../generated/prisma";
import { buildConfigTs } from "~/lib/install/config-writer";
import type { InstallPayload, FinalizeResult } from "~/types/install";
import type { InstallLockData } from "~/types/install";

function isInstalled(): boolean {
  if (process.env.INSTALL_COMPLETE === "true") return true;
  return existsSync(join(process.cwd(), "install.lock"));
}

function setInstalled(): void {
  writeFileSync(join(process.cwd(), ".env"), `\nINSTALL_COMPLETE=true\n`, { flag: "a" });
}

export async function POST(req: NextRequest) {
  if (isInstalled()) {
    return NextResponse.json({ success: false, error: "Already installed" } satisfies FinalizeResult, { status: 403 });
  }

  const payload = await req.json() as Partial<InstallPayload>;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      try {
        send(JSON.stringify({ step: "Generating secrets...", done: false }));

        const nextauthSecret = randomBytes(32).toString("hex");
        const encryptionKey = randomBytes(32).toString("hex");

        send(JSON.stringify({ step: "Writing .env file...", done: false }));

        const envPath = join(process.cwd(), ".env");
        const existingEnv = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
        const envLines: Record<string, string> = {};

        for (const line of existingEnv.split("\n")) {
          const match = line.match(/^([A-Z_]+)=(.*)$/);
          if (match) envLines[match[1]] = match[2];
        }

        envLines["NEXTAUTH_SECRET"] = nextauthSecret;
        envLines["NEXTAUTH_URL"] = payload.app?.url ?? "https://localhost";
        envLines["ENCRYPTION_KEY"] = encryptionKey;
        envLines["DATABASE_URL"] = payload.database?.connectionString ?? envLines["DATABASE_URL"] ?? "";
        envLines["INSTALL_COMPLETE"] = "true";
        envLines["POSTGRES_USER"] = "mailforge";
        envLines["POSTGRES_PASSWORD"] = envLines["POSTGRES_PASSWORD"] || randomBytes(16).toString("hex");
        envLines["POSTGRES_DB"] = "mailforge";
        envLines["REDIS_PASSWORD"] = envLines["REDIS_PASSWORD"] || randomBytes(16).toString("hex");
        envLines["REDIS_URL"] = `redis://:${envLines["REDIS_PASSWORD"]}@redis:6379`;

        if (payload.auth?.providers?.google) {
          envLines["GOOGLE_CLIENT_ID"] = payload.auth.providers.googleClientId ?? "";
          envLines["GOOGLE_CLIENT_SECRET"] = payload.auth.providers.googleClientSecret ?? "";
        }
        if (payload.auth?.providers?.github) {
          envLines["GITHUB_CLIENT_ID"] = payload.auth.providers.githubClientId ?? "";
          envLines["GITHUB_CLIENT_SECRET"] = payload.auth.providers.githubClientSecret ?? "";
        }
        if (payload.auth?.providers?.microsoft) {
          envLines["MICROSOFT_CLIENT_ID"] = payload.auth.providers.microsoftClientId ?? "";
          envLines["MICROSOFT_CLIENT_SECRET"] = payload.auth.providers.microsoftClientSecret ?? "";
        }

        const newEnv = Object.entries(envLines).map(([k, v]) => `${k}="${v}"`).join("\n");
        writeFileSync(envPath, newEnv, "utf-8");

        send(JSON.stringify({ step: "Writing config.ts...", done: false }));

        const configContent = buildConfigTs(payload as InstallPayload);
        writeFileSync(join(process.cwd(), "config.ts"), configContent, "utf-8");

        send(JSON.stringify({ step: "Running database migrations...", done: false }));

        try {
          execSync("pnpm prisma migrate deploy", {
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URL: payload.database?.connectionString },
            stdio: "pipe",
          });
        } catch (migrateErr) {
          const migrateError = migrateErr instanceof Error ? migrateErr.message : String(migrateErr);
          const hasMigrations = migrateError.includes("No pending migrations");
          if (!hasMigrations) {
            throw new Error(`Migration failed: ${migrateError}`);
          }
        }

        send(JSON.stringify({ step: "Running database seed...", done: false }));

        try {
          execSync("pnpm db:seed", {
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URL: payload.database?.connectionString },
            stdio: "pipe",
          });
        } catch {
          // seed may fail if users exist — non-fatal
        }

        send(JSON.stringify({ step: "Creating admin account...", done: false }));

        const db = new PrismaClient({
          datasources: { db: { url: payload.database?.connectionString ?? "" } },
          log: [],
        });

        const hashedPassword = await bcryptjs.hash(payload.admin?.password ?? "Admin123!", 12);
        const adminEmail = payload.admin?.email ?? "admin@mailforge.dev";

        const admin = await db.user.upsert({
          where: { email: adminEmail },
          create: {
            email: adminEmail,
            name: payload.admin?.name ?? "Admin",
            password: hashedPassword,
            role: "ADMIN",
            emailVerified: new Date(),
            settings: {},
          },
          update: {
            password: hashedPassword,
            role: "ADMIN",
          },
        });

        send(JSON.stringify({ step: "Creating mail account...", done: false }));

        if (payload.mailAccount) {
          const encryptedCreds = Buffer.from(
            JSON.stringify({
              imapPassword: payload.mailAccount.imap?.host ? "placeholder" : "",
              smtpPassword: payload.mailAccount.smtp?.host ? "placeholder" : "",
            })
          ).toString("base64");

          await db.mailAccount.upsert({
            where: { email: payload.mailAccount.email },
            create: {
              userId: admin.id,
              email: payload.mailAccount.email,
              displayName: payload.mailAccount.displayName,
              credentials: encryptedCreds,
              imapHost: payload.mailAccount.imap?.host ?? "",
              imapPort: payload.mailAccount.imap?.port ?? 993,
              imapTls: payload.mailAccount.imap?.tls ?? true,
              smtpHost: payload.mailAccount.smtp?.host ?? "",
              smtpPort: payload.mailAccount.smtp?.port ?? 587,
              smtpSecure: payload.mailAccount.smtp?.secure ?? false,
              color: payload.mailAccount.color,
              emoji: payload.mailAccount.emoji,
              isDefault: true,
            },
            update: {},
          });

          const systemLabels = [
            { name: "Inbox", type: "INBOX" as const, icon: "📥", color: "#4f46e5", order: 0 },
            { name: "Sent", type: "SENT" as const, icon: "📤", color: "#059669", order: 1 },
            { name: "Drafts", type: "DRAFTS" as const, icon: "📝", color: "#d97706", order: 2 },
            { name: "Trash", type: "TRASH" as const, icon: "🗑️", color: "#dc2626", order: 3 },
            { name: "Spam", type: "SPAM" as const, icon: "⚠️", color: "#ea580c", order: 4 },
            { name: "Archive", type: "ARCHIVE" as const, icon: "📦", color: "#6b7280", order: 5 },
          ];

          await db.label.createMany({
            data: systemLabels.map((l) => ({
              userId: admin.id,
              name: l.name,
              type: l.type,
              icon: l.icon,
              color: l.color,
              isSystem: true,
              order: l.order,
            })),
            skipDuplicates: true,
          });
        }

        await db.$disconnect();

        send(JSON.stringify({ step: "Creating install.lock...", done: false }));

        const lockData: InstallLockData = {
          installedAt: new Date().toISOString(),
          version: "0.1.0",
          adminEmail,
        };
        writeFileSync(
          join(process.cwd(), "install.lock"),
          JSON.stringify(lockData, null, 2),
          "utf-8"
        );

        send(JSON.stringify({ step: "Done!", done: true, redirectTo: "/" }));
        controller.close();
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        send(JSON.stringify({ step: `Error: ${error}`, done: true, error }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}