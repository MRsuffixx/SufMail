/**
 * MailForge — NextAuth v5 Configuration
 *
 * Configures authentication providers, session strategy, callbacks, and events.
 * Providers are enabled/disabled via config.auth.providers in config.ts.
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import Nodemailer from "next-auth/providers/nodemailer";
import { z } from "zod";

import { db } from "~/server/db";
import { env } from "~/env";
import { config } from "~/config";
import { isEmailDomainAllowed } from "~/lib/config-utils";
import { verifyPassword, createSystemLabels } from "./helpers";

// ─── Session Type Augmentation ────────────────────────────────────────────────

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: "USER" | "ADMIN";
      email: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "USER" | "ADMIN";
  }
}

// ─── Credentials Validation Schema ───────────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// ─── Provider Builders ────────────────────────────────────────────────────────

function buildProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];
  const p = config.auth.providers;

  if (p.credentials) {
    providers.push(
      CredentialsProvider({
        id: "credentials",
        name: "Email & Password",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const { email, password } = parsed.data;

          if (!isEmailDomainAllowed(email)) return null;

          const user = await db.user.findUnique({ where: { email } });
          if (!user?.password) return null;

          const valid = await verifyPassword(password, user.password);
          if (!valid) return null;

          return {
            id: user.id,
            email: user.email ?? "",
            name: user.name,
            image: user.image,
            role: user.role,
          };
        },
      }),
    );
  }

  if (p.google && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }),
    );
  }

  if (p.github && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      }),
    );
  }

  if (
    p.microsoft &&
    env.MICROSOFT_CLIENT_ID &&
    env.MICROSOFT_CLIENT_SECRET
  ) {
    providers.push(
      MicrosoftEntraId({
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        // tenantId: "common" — use the MICROSOFT_TENANT_ID env var if needed
      }),
    );
  }

  if (
    p.magicLink &&
    env.EMAIL_SERVER_HOST &&
    env.EMAIL_FROM
  ) {
    providers.push(
      Nodemailer({
        server: {
          host: env.EMAIL_SERVER_HOST,
          port: env.EMAIL_SERVER_PORT ?? 587,
          auth: {
            user: env.EMAIL_SERVER_USER,
            pass: env.EMAIL_SERVER_PASSWORD,
          },
        },
        from: env.EMAIL_FROM,
      }),
    );
  }

  return providers;
}

// ─── Auth Config ──────────────────────────────────────────────────────────────

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(db),
  providers: buildProviders(),

  session: {
    strategy: "jwt",
    maxAge: config.auth.sessionMaxAgeSeconds,
  },

  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/verify-request",
  },

  callbacks: {
    /**
     * Controls whether a sign-in is allowed.
     * Enforces allowedEmailDomains and allowRegistration config.
     * Domain check applies to ALL providers (credentials AND OAuth).
     */
    async signIn({ user, account }) {
      // Enforce email domain allowlist for ALL sign-in methods (including OAuth).
      // This prevents users with disallowed domains from accessing via OAuth
      // even if they bypass the credentials flow.
      if (!user.email) return false;
      if (!isEmailDomainAllowed(user.email)) return false;

      // For OAuth providers only: check if new user registration is allowed.
      if (account?.provider !== "credentials") {
        if (!config.auth.allowRegistration) {
          const existing = await db.user.findUnique({
            where: { email: user.email },
          });
          if (!existing) return false;
        }
      }
      return true;
    },

    /**
     * Extends the JWT token with user role and ID.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },

    /**
     * Extends the session with user ID and role from JWT.
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role ?? "USER") as "USER" | "ADMIN";
      }
      return session;
    },
  },

  events: {
    /**
     * When a user is created for the first time, set up their default labels.
     */
    async createUser({ user }) {
      if (user.id) {
        await createSystemLabels(user.id);
      }
    },
  },
};
