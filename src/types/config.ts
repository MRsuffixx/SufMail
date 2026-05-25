/**
 * MailForge — Config Type Re-exports
 *
 * Re-exports all config types from the root config module.
 * Import from here to avoid circular dependency issues.
 */

export type {
  AppConfig,
  AppSection,
  ThemeSection,
  ImapConfig,
  SmtpConfig,
  MailSection,
  FeaturesSection,
  BehaviorSection,
  AuthProvidersSection,
  TwoFactorSection,
  AuthSection,
  StorageSection,
  NotificationsSection,
  AdvancedSection,
} from "~/config";
