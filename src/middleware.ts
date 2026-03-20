/**
 * PRISM Route Protection Middleware
 *
 * NextAuth.js v5 edge middleware for route protection.
 * Uses auth.config.ts (edge-compatible, no Prisma) instead of auth.ts.
 *
 * Behavior:
 * - When auth is NOT configured (no providers): all routes pass through
 * - When auth IS configured: protects platform routes, allows public routes
 * - API routes under /api/auth/* always pass through (auth endpoints themselves)
 * - Static assets and public routes are never blocked
 */

import NextAuth from "next-auth";
import { authConfig, isAuthEnabled } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Routes that are always public (no auth required)
const PUBLIC_PATHS = [
  "/auth/signin",
  "/auth/error",
  "/api/auth",
  "/api/pipeline/stream",  // SSE stream (auth checked at connection level)
  "/_next",
  "/favicon.ico",
  "/styles",
  "/js",
  "/decks",
  "/pdfs",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export default auth((req) => {
  // If auth isn't configured, allow everything through
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // Always allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // If user is authenticated, allow through
  if (req.auth) {
    return NextResponse.next();
  }

  // No auth session — redirect to sign in
  const signInUrl = new URL("/auth/signin", req.url);
  signInUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  // Match all routes except static files and images
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|styles/|js/|decks/|pdfs/).*)",
  ],
};
