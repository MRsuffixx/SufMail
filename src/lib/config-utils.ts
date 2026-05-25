/**
 * MailForge — Config Utilities
 *
 * Helper functions for working with the AppConfig object.
 */

import { type AppConfig, type FeaturesSection, config } from "~/config";

// ─── Theme CSS Variables ─────────────────────────────────────────────────────

export interface ThemeCssVars {
  "--color-primary": string;
  "--color-accent": string;
  "--font-family": string;
  "--border-radius": string;
  "--spacing-density": string;
  [key: string]: string;
}

const BORDER_RADIUS_MAP: Record<AppConfig["theme"]["borderRadius"], string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
};

const DENSITY_MAP: Record<AppConfig["theme"]["density"], string> = {
  compact: "4px",
  comfortable: "8px",
  spacious: "16px",
};

/**
 * Converts the theme config section into CSS custom properties.
 * Apply these to the `:root` element.
 */
export function getThemeCssVars(themeConfig: AppConfig["theme"]): ThemeCssVars {
  return {
    "--color-primary": themeConfig.primaryColor,
    "--color-accent": themeConfig.accentColor,
    "--font-family": themeConfig.fontFamily,
    "--border-radius": BORDER_RADIUS_MAP[themeConfig.borderRadius],
    "--spacing-density": DENSITY_MAP[themeConfig.density],
  };
}

/**
 * Returns a CSS string of custom properties from the theme config.
 */
export function getThemeCssString(themeConfig: AppConfig["theme"]): string {
  const vars = getThemeCssVars(themeConfig);
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n");
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

/**
 * Checks whether a feature is enabled in the global config.
 *
 * @example
 * if (isFeatureEnabled("attachments")) { ... }
 */
export function isFeatureEnabled(key: keyof FeaturesSection): boolean {
  return config.features[key];
}

/**
 * Returns the full features config object for use in server components.
 */
export function getFeatures(): FeaturesSection {
  return config.features;
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if the given email domain is allowed by the auth config.
 */
export function isEmailDomainAllowed(email: string): boolean {
  const { allowedEmailDomains } = config.auth;
  if (allowedEmailDomains === null || allowedEmailDomains.length === 0) {
    return true;
  }
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return allowedEmailDomains.map((d) => d.toLowerCase()).includes(domain);
}

/**
 * Returns true if the given mail account domain is allowed by the mail config.
 */
export function isMailDomainAllowed(email: string): boolean {
  const { allowedDomains } = config.mail;
  if (allowedDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return allowedDomains.map((d) => d.toLowerCase()).includes(domain);
}
