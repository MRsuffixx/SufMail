/**
 * MailForge — Database Seed Script
 *
 * Creates:
 * - A demo admin user (admin@mailforge.dev / MailForge123!)
 * - System labels for the admin user
 * - A test mail account entry
 *
 * Run with: pnpm db:seed
 */

import { PrismaClient } from "../../../generated/prisma";
import bcryptjs from "bcryptjs";
import crypto from "crypto";

const db = new PrismaClient();

async function main() {
  console.info("🌱 Starting MailForge seed...\n");

  // ── Check ENCRYPTION_KEY ─────────────────────────────────────────────────
  if (!process.env.ENCRYPTION_KEY) {
    console.error("❌ ENCRYPTION_KEY environment variable is required.");
    console.error("   Run: openssl rand -hex 32");
    console.error("   Then add it to your .env file as ENCRYPTION_KEY=<value>");
    throw new Error("ENCRYPTION_KEY environment variable is required for seeding");
  }

  // ── Create Admin User ────────────────────────────────────────────────────
  const adminEmail = "admin@mailforge.dev";
  const adminPassword = "MailForge123!";
  const hashedPassword = await bcryptjs.hash(adminPassword, 12);

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "MailForge Admin",
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

  console.info(`✓ Admin user: ${adminEmail} / ${adminPassword}`);
  console.info(`  User ID: ${admin.id}`);

  // ── Create Demo User ─────────────────────────────────────────────────────
  const demoEmail = "demo@mailforge.dev";
  const demoPassword = "Demo123456!";
  const hashedDemoPassword = await bcryptjs.hash(demoPassword, 12);

  const demo = await db.user.upsert({
    where: { email: demoEmail },
    create: {
      email: demoEmail,
      name: "Demo User",
      password: hashedDemoPassword,
      role: "USER",
      emailVerified: new Date(),
      settings: {},
    },
    update: {},
  });

  console.info(`✓ Demo user: ${demoEmail} / ${demoPassword}`);
  console.info(`  User ID: ${demo.id}`);

  // ── Create System Labels for Both Users ──────────────────────────────────
  const systemLabels = [
    { name: "Inbox", type: "INBOX" as const, icon: "📥", color: "#4f46e5", order: 0 },
    { name: "Sent", type: "SENT" as const, icon: "📤", color: "#059669", order: 1 },
    { name: "Drafts", type: "DRAFTS" as const, icon: "📝", color: "#d97706", order: 2 },
    { name: "Trash", type: "TRASH" as const, icon: "🗑️", color: "#dc2626", order: 3 },
    { name: "Spam", type: "SPAM" as const, icon: "⚠️", color: "#ea580c", order: 4 },
    { name: "Archive", type: "ARCHIVE" as const, icon: "📦", color: "#6b7280", order: 5 },
  ];

  for (const userId of [admin.id, demo.id]) {
    await db.label.createMany({
      data: systemLabels.map((l) => ({
        userId,
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

  console.info(`✓ System labels created for both users`);

  // ── Create Custom Label for Demo ─────────────────────────────────────────
  await db.label.upsert({
    where: { userId_name: { userId: demo.id, name: "Important" } },
    create: {
      userId: demo.id,
      name: "Important",
      type: "CUSTOM",
      icon: "⭐",
      color: "#eab308",
      isSystem: false,
      order: 6,
    },
    update: {},
  });

  console.info(`✓ Custom "Important" label created for demo user`);

  // ── Create Sample Contact for Demo ───────────────────────────────────────
  await db.contact.upsert({
    where: { userId_email: { userId: demo.id, email: "alice@example.com" } },
    create: {
      userId: demo.id,
      email: "alice@example.com",
      name: "Alice Johnson",
      company: "Acme Corp",
      phone: "+1 555-0101",
    },
    update: {},
  });

  console.info(`✓ Sample contact created`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.info("\n✅ Seed complete!\n");
  console.info("📋 Quick Reference:");
  console.info("─────────────────────────────────────────");
  console.info(`  Admin Login:  ${adminEmail} / ${adminPassword}`);
  console.info(`  Demo Login:   ${demoEmail} / ${demoPassword}`);
  console.info("─────────────────────────────────────────");
  console.info("\nNext steps:");
  console.info("  1. Copy .env.example to .env and fill in values");
  console.info("  2. Run: pnpm db:push (to apply schema)");
  console.info("  3. Run: pnpm dev (to start Next.js)");
  console.info("  4. Run: pnpm worker:dev (in a separate terminal)");
  console.info("  5. Add a mail account via the app settings\n");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
