/**
 * MailForge — Next.js Middleware
 *
 * Protects /app/* routes, requiring authentication.
 * Installs guard: redirects to /install if not yet installed.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { auth } from "~/server/auth";

function isInstalled(): boolean {
  if (process.env.INSTALL_COMPLETE === "true") return true;
  const lockPath = join(process.cwd(), "install.lock");
  return existsSync(lockPath);
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isAppRoute = nextUrl.pathname.startsWith("/app");
  const isApiRoute = nextUrl.pathname.startsWith("/api");
  const isAuthRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/register") ||
    nextUrl.pathname.startsWith("/verify-request") ||
    nextUrl.pathname.startsWith("/api/auth");
  const isInstallRoute = nextUrl.pathname.startsWith("/install");
  const isHealthRoute = nextUrl.pathname === "/api/health";
  const isStatusRoute = nextUrl.pathname === "/status";

  if (!isInstalled()) {
    if (!isInstallRoute && !isHealthRoute && !isStatusRoute) {
      const installUrl = new URL("/install", nextUrl.origin);
      return Response.redirect(installUrl);
    }
    if (isInstallRoute && nextUrl.pathname === "/install") {
      return undefined;
    }
  }

  if (isInstalled() && isInstallRoute && nextUrl.pathname === "/install") {
    return Response.redirect(new URL("/", nextUrl.origin));
  }

  // Protect app routes
  if (isAppRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  // Redirect logged-in users away from auth pages
  if (isAuthRoute && isLoggedIn && !isApiRoute) {
    return Response.redirect(new URL("/app/inbox", nextUrl.origin));
  }

  return undefined;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|woff|woff2)$).*)",
  ],
};