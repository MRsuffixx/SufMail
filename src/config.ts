/**
 * MailForge Configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for all application configuration.
 * Customize this file to change the behavior, appearance, and features of your MailForge instance.
 *
 * @see https://github.com/mailforge/mailforge/docs/configuration
 */

// ─── Sub-interfaces ─────────────────────────────────────────────────────────

export interface AppSection {
  /** Display name of the application */
  name: string;
  /** Short tagline shown on login page */
  tagline: string;
  /** Path to logo image (relative to /public) */
  logo: string;
  /** Path to favicon (relative to /public) */
  favicon: string;
  /** Canonical URL of the deployment */
  url: string;
}

export interface ThemeSection {
  defaultMode: "light" | "dark" | "system";
  /** Primary brand color (hex or hsl string) */
  primaryColor: string;
  /** Accent / highlight color */
  accentColor: string;
  /** CSS font-family string */
  fontFamily: string;
  borderRadius: "none" | "sm" | "md" | "lg" | "xl";
  density: "compact" | "comfortable" | "spacious";
  sidebarPosition: "left" | "right";
  mailListLayout: "default" | "preview" | "minimal" | "cards";
  animationsEnabled: boolean;
}

export interface ImapConfig {
  host: string;
  port: number;
  tls: boolean;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
}

export interface MailSection {
  imap: ImapConfig;
  smtp: SmtpConfig;
  /** How often to sync mailboxes (seconds) */
  syncIntervalSeconds: number;
  /** Maximum attachment size in megabytes */
  maxAttachmentSizeMB: number;
  /** Default "From" display name */
  defaultFromName: string;
  /** If non-empty, only these domains can be added as mail accounts */
  allowedDomains: string[];
  /** Maximum mail accounts per user */
  maxAccountsPerUser: number;
}

export interface FeaturesSection {
  compose: boolean;
  richText: boolean;
  attachments: boolean;
  contacts: boolean;
  labels: boolean;
  filters: boolean;
  snooze: boolean;
  scheduleSend: boolean;
  unsubscribeDetection: boolean;
  readReceipts: boolean;
  aiAssist: boolean;
  multiAccount: boolean;
  delegation: boolean;
  importExport: boolean;
  encryptionPGP: boolean;
}

export interface BehaviorSection {
  /** Seconds to wait before marking a message read (null = never auto-mark) */
  markReadDelaySeconds: number | null;
  defaultReplyAll: boolean;
  /** Undo send window in seconds */
  sendUndoWindowSeconds: number;
  threadView: boolean;
  pagination: "paged" | "infinite";
  defaultSort: "date" | "sender" | "subject";
  /** Auto-save draft interval in seconds */
  autoSaveDraftSeconds: number;
  confirmBeforeDelete: boolean;
}

export interface AuthProvidersSection {
  google: boolean;
  github: boolean;
  microsoft: boolean;
  magicLink: boolean;
  credentials: boolean;
}

export interface TwoFactorSection {
  enabled: boolean;
  required: boolean;
}

export interface AuthSection {
  allowRegistration: boolean;
  /** If set, only these email domains can register */
  allowedEmailDomains: string[] | null;
  requireEmailVerification: boolean;
  /** Session max age in seconds */
  sessionMaxAgeSeconds: number;
  providers: AuthProvidersSection;
  twoFactor: TwoFactorSection;
}

export interface StorageSection {
  provider: "s3" | "r2" | "local";
  bucket: string;
  region: string;
  publicUrl: string;
}

export interface NotificationsSection {
  browser: boolean;
  sound: boolean;
  /** Path to sound file in /public */
  soundFile: string;
  emailDigest: boolean;
  digestIntervalHours: number;
}

export interface AdvancedSection {
  rateLimitPerMinute: number;
  maxConcurrentImap: number;
  searchProvider: "database" | "meilisearch";
  logLevel: "error" | "warn" | "info" | "debug";
  maintenanceMode: boolean;
}

// ─── Root Interface ──────────────────────────────────────────────────────────

export interface AppConfig {
  app: AppSection;
  theme: ThemeSection;
  mail: MailSection;
  features: FeaturesSection;
  behavior: BehaviorSection;
  auth: AuthSection;
  storage: StorageSection;
  notifications: NotificationsSection;
  advanced: AdvancedSection;
}

// ─── Default Config ──────────────────────────────────────────────────────────

export const config: AppConfig = {
  app: {
    name: "MailForge",
    tagline: "A powerful, open-source webmail client",
    logo: "/logo.svg",
    favicon: "/favicon.ico",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  },

  theme: {
    defaultMode: "system",
    primaryColor: "hsl(221, 83%, 53%)",
    accentColor: "hsl(262, 83%, 58%)",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    borderRadius: "md",
    density: "comfortable",
    sidebarPosition: "left",
    mailListLayout: "default",
    animationsEnabled: true,
  },

  mail: {
    imap: {
      host: "imap.gmail.com",
      port: 993,
      tls: true,
    },
    smtp: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
    },
    syncIntervalSeconds: 300, // 5 minutes
    maxAttachmentSizeMB: 25,
    defaultFromName: "MailForge User",
    allowedDomains: [], // empty = all domains allowed
    maxAccountsPerUser: 5,
  },

  features: {
    compose: true,
    richText: true,
    attachments: true,
    contacts: true,
    labels: true,
    filters: true,
    snooze: true,
    scheduleSend: true,
    unsubscribeDetection: true,
    readReceipts: false,
    aiAssist: false,
    multiAccount: true,
    delegation: false,
    importExport: true,
    encryptionPGP: false,
  },

  behavior: {
    markReadDelaySeconds: 2,
    defaultReplyAll: false,
    sendUndoWindowSeconds: 10,
    threadView: true,
    pagination: "infinite",
    defaultSort: "date",
    autoSaveDraftSeconds: 30,
    confirmBeforeDelete: true,
  },

  auth: {
    allowRegistration: true,
    allowedEmailDomains: null, // null = all domains allowed
    requireEmailVerification: false,
    sessionMaxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
    providers: {
      google: false,
      github: false,
      microsoft: false,
      magicLink: false,
      credentials: true,
    },
    twoFactor: {
      enabled: false,
      required: false,
    },
  },

  storage: {
    provider: "local",
    bucket: "mailforge-attachments",
    region: "auto",
    publicUrl: "/uploads",
  },

  notifications: {
    browser: true,
    sound: true,
    soundFile: "/sounds/notification.mp3",
    emailDigest: false,
    digestIntervalHours: 24,
  },

  advanced: {
    rateLimitPerMinute: 60,
    maxConcurrentImap: 5,
    searchProvider: "database",
    logLevel: "info",
    maintenanceMode: false,
  },
};
