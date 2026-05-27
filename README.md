# MailForge

> A highly advanced, production-grade, fully configurable open-source webmail application built with the T3 Stack.

![MailForge](https://img.shields.io/badge/T3-Stack-purple?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square)

## ✨ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| API | tRPC v11 + React Query v5 |
| Database | Prisma 5 + PostgreSQL |
| Auth | NextAuth.js v5 (Auth.js) |
| Styling | Tailwind CSS v4 |
| Queue | BullMQ + Redis (ioredis) |
| Storage | AWS S3 / Cloudflare R2 / Local |
| IMAP | imapflow |
| SMTP | nodemailer |
| Rich Text | TipTap |
| Validation | Zod |
| Dates | date-fns |
| HTML Sanitization | DOMPurify |
| Language | TypeScript (strict mode, no `any`) |

---

## 🚀 Setup Instructions

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL (or a Neon/Supabase cloud DB)
- Redis (local or Upstash)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/mailforge.git
cd mailforge
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in at minimum:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/mailforge"
AUTH_SECRET="your-32-char-secret-here"
ENCRYPTION_KEY="your-64-hex-char-key-here"  # See below
REDIS_URL="redis://localhost:6379"
```

**Generate `ENCRYPTION_KEY`:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generate `AUTH_SECRET`:**
```bash
npx auth secret
```

### 3. Push Database Schema

```bash
pnpm db:push
```

### 4. Seed the Database

```bash
pnpm db:seed
```

This creates:
- **Admin**: `admin@mailforge.dev` / `MailForge123!`
- **Demo**: `demo@mailforge.dev` / `Demo123456!`
- System labels (Inbox, Sent, Drafts, Trash, Spam, Archive) for both users

### 5. Start the App

```bash
# Terminal 1: Next.js
pnpm dev

# Terminal 2: Background workers
pnpm worker:dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Customizing via `config.ts`

**`src/config.ts`** is the single source of truth for all app configuration. You never need to touch any other file to customize the app.

### App Branding
```typescript
app: {
  name: "MyMail",
  tagline: "Your company's webmail",
  logo: "/logo.svg",
  url: "https://mail.company.com",
}
```

### Theme
```typescript
theme: {
  defaultMode: "dark",
  primaryColor: "hsl(221, 83%, 53%)",
  borderRadius: "lg",
  density: "compact",
  mailListLayout: "preview",
}
```

### Authentication
```typescript
auth: {
  allowRegistration: false,           // Self-hosted: restrict to invites
  allowedEmailDomains: ["company.com"], // Only allow company emails
  providers: {
    google: true,                     // Enable Google OAuth
    credentials: false,               // Disable password auth
  },
}
```

### Feature Flags
```typescript
features: {
  aiAssist: true,
  scheduleSend: true,
  encryptionPGP: false,
  snooze: true,
}
```

### Mail Settings
```typescript
mail: {
  syncIntervalSeconds: 60,       // Sync every minute
  maxAttachmentSizeMB: 50,       // 50MB attachments
  maxAccountsPerUser: 3,
}
```

---

## 📬 Adding a Mail Account

After logging in:

1. Go to **Settings → Accounts → Add Account**
2. Enter your email, IMAP, and SMTP credentials
3. Click **Test Connection** to verify before saving
4. The account will start syncing automatically via the worker

### Gmail Example
| Field | Value |
|-------|-------|
| IMAP Host | `imap.gmail.com` |
| IMAP Port | `993` (TLS) |
| SMTP Host | `smtp.gmail.com` |
| SMTP Port | `587` |
| Password | Your Gmail App Password |

> **Note**: Use an [App Password](https://support.google.com/accounts/answer/185833) if you have 2FA enabled on Gmail.

---

## ⚡ Running the Sync Worker

The sync worker is a separate process that must run alongside Next.js.

```bash
# Development (with hot reload)
pnpm worker:dev

# Production
pnpm worker:start
```

The worker handles:
- **Periodic IMAP sync** — fetches new emails every `config.mail.syncIntervalSeconds`
- **Mail sending** — sends queued drafts via SMTP
- **Notifications** — logs and dispatches notifications
- **Snooze wakeup** — restores snoozed messages at the right time

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── config.ts               # ← SINGLE SOURCE OF TRUTH for config
├── env.js                  # Environment variable validation
├── middleware.ts            # Route protection (auth guard)
├── worker.ts               # BullMQ worker entry point
│
├── lib/                    # Shared utilities
│   ├── config-utils.ts     # Theme CSS vars, feature flag helpers
│   ├── crypto.ts           # AES-256-GCM encryption/decryption
│   ├── mail-utils.ts       # Email parsing, snippet, thread utils
│   ├── search.ts           # Full-text search (PG or Meilisearch)
│   └── storage.ts          # Unified S3/R2/local file storage
│
├── types/                  # Shared TypeScript types
│   ├── api.ts              # tRPC router output types
│   ├── config.ts           # Config type re-exports
│   └── mail.ts             # Core mail domain types
│
└── server/
    ├── api/
    │   ├── root.ts         # tRPC router wiring
    │   ├── trpc.ts         # tRPC initialization, middleware
    │   └── routers/
    │       ├── accounts.ts # Mail account management
    │       ├── admin.ts    # Admin-only procedures
    │       ├── contacts.ts # Address book
    │       ├── drafts.ts   # Draft auto-save & scheduling
    │       ├── filters.ts  # Automated filter rules
    │       ├── labels.ts   # Label management
    │       ├── mail.ts     # Core mail operations
    │       └── settings.ts # User preferences & data export
    │
    ├── auth/
    │   ├── config.ts       # NextAuth providers, callbacks, events
    │   ├── helpers.ts      # Password hashing, system label creation
    │   └── index.ts        # Auth exports (auth, handlers, signIn, signOut)
    │
    ├── db.ts               # Prisma client singleton
    ├── db/
    │   └── seed.ts         # Database seed script
    │
    ├── mail/
    │   ├── imap.ts         # IMAP service (imapflow)
    │   ├── parser.ts       # Email parser + DOMPurify sanitization
    │   ├── smtp.ts         # SMTP service (nodemailer)
    │   └── sync.ts         # Mail sync service + system label creation
    │
    └── queue/
        ├── client.ts       # BullMQ queue instances + Redis connection
        ├── scheduler.ts    # Repeatable job scheduling
        └── workers.ts      # BullMQ worker definitions
```

---

## 🔐 Security Notes

- **Credentials are encrypted** using AES-256-GCM before storage. The `ENCRYPTION_KEY` must be kept secret and backed up — losing it makes stored credentials unrecoverable.
- **HTML email bodies** are sanitized with DOMPurify to prevent XSS.
- **All API routes** are protected by tRPC's `protectedProcedure` — unauthenticated requests are rejected with `UNAUTHORIZED`.
- **Admin routes** use an additional role check (`ADMIN` required).

---

## 📦 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Next.js in dev mode |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm db:push` | Push Prisma schema to DB |
| `pnpm db:seed` | Seed the database |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm worker:dev` | Start workers with hot reload |
| `pnpm worker:start` | Start workers in production |
| `pnpm typecheck` | TypeScript type check |
| `pnpm lint` | ESLint check |

---

## 🤝 Contributing

PRs welcome! Please ensure:
- Zero TypeScript `any` types
- Zod validation on all tRPC inputs
- Tests for new utility functions
- Config-driven behavior (no hardcoded values)

---

## Docker Deployment

### Quick Start
1. Clone the repo
2. `cp .env.docker.example .env`
3. `make build`
4. `make start`
5. Open http://localhost (install wizard will appear)
6. Complete the wizard — takes ~2 minutes
7. You're done.

### Development
`make dev`     # hot reload, mailhog on :8025, db on :5432

### Reset Installer (without wiping data)
`make reset-install`

### Logs
`make logs`

### Database Shell
`make db-shell`
