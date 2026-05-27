export interface ImapCredentials {
  host: string;
  port: number;
  tls: boolean;
  user: string;
  password: string;
}

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface DatabasePayload {
  connectionString: string;
  useDocker: boolean;
}

export interface AppPayload {
  name: string;
  url: string;
  tagline?: string;
  logo?: string;
  theme: {
    defaultMode: "light" | "dark" | "system";
    primaryColor: string;
    density: "compact" | "comfortable" | "spacious";
    mailListLayout: "default" | "preview" | "minimal" | "cards";
    animationsEnabled: boolean;
    sidebarPosition: "left" | "right";
  };
}

export interface MailPayload {
  imap: ImapCredentials;
  smtp: SmtpCredentials;
  syncInterval: number;
  maxAttachmentSize: number;
  allowedDomains: string[];
}

export interface AuthProvidersPayload {
  google: boolean;
  github: boolean;
  microsoft: boolean;
  magicLink: boolean;
  credentials: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  microsoftClientId?: string;
  microsoftClientSecret?: string;
}

export interface AuthPayload {
  allowRegistration: boolean;
  allowedDomains: string[];
  requireEmailVerification: boolean;
  enable2FA: boolean;
  require2FA: boolean;
  sessionDays: number;
  providers: AuthProvidersPayload;
}

export interface AdminPayload {
  name: string;
  email: string;
  password: string;
}

export interface MailAccountPayload {
  email: string;
  imap: ImapCredentials;
  smtp: SmtpCredentials;
  displayName: string;
  color: string;
  emoji: string;
}

export interface InstallPayload {
  database: DatabasePayload;
  app: AppPayload;
  mail: MailPayload;
  auth: AuthPayload;
  admin: AdminPayload;
  mailAccount?: MailAccountPayload;
}

export type InstallStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface StepStatus {
  step: InstallStep;
  completed: boolean;
  data?: Partial<InstallPayload>;
}

export interface SystemCheckResult {
  check: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

export interface TestDbResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
}

export interface TestConnectionResult {
  success: boolean;
  capabilities?: string[];
  latencyMs?: number;
  error?: string;
}

export interface TestMailAccountResult {
  success: boolean;
  subject?: string;
  from?: string;
  date?: string;
  error?: string;
}

export interface FinalizeResult {
  success: boolean;
  redirectTo?: string;
  error?: string;
}

export interface InstallLockData {
  installedAt: string;
  version: string;
  adminEmail: string;
}