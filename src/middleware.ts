/**
 * MailForge — Next.js Middleware
 *
 * Protects /app/* routes, requiring authentication.
 * Unauthenticated users are redirected to /login.
 */

import { auth } from "~/server/auth";

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
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|woff|woff2)$).*)",
  ],
};
