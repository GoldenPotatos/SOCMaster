/**
 * Next.js Edge Middleware — Route Protection
 *
 * This middleware intercepts requests to protected routes and verifies
 * that the user has a valid session cookie before allowing access.
 *
 * SECURITY NOTES:
 * - Runs at the edge (before the page renders)
 * - Cannot import firebase-admin (Node.js only), so we check cookie
 *   existence here and delegate full verification to the API route
 * - Unauthenticated users are redirected to /login
 * - Public routes (/login, /api, static assets) are always allowed
 */

import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard"];

// Routes that are always public
const PUBLIC_ROUTES = ["/login", "/api", "/_next", "/favicon.ico"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without any checks
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if the current path is a protected route
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for session cookie existence
  const sessionCookie = request.cookies.get("__session");

  if (!sessionCookie?.value) {
    // No session cookie — redirect to login
    const loginUrl = new URL("/login", request.url);
    // Preserve the original URL so we can redirect back after login
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists — allow through. Full verification happens in the
  // page/layout via the /api/auth/verify endpoint. This provides
  // defense-in-depth: edge check + server verification.
  return NextResponse.next();
}

export const config = {
  // Match all routes except static files and images
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
