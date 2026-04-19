/**
 * Session Verification API Route
 *
 * GET: Verifies the session cookie and returns decoded user claims.
 *
 * This route is called by:
 * 1. Middleware — to gate access to protected routes
 * 2. Client components — to get the current authenticated user's info
 *
 * SECURITY: The `checkRevoked: true` flag ensures that if a user's
 * session is revoked server-side (e.g., account compromised), they
 * are immediately logged out even if the cookie hasn't expired.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { authenticated: false, error: "No session cookie" },
        { status: 401 }
      );
    }

    // Verify session cookie and check if it has been revoked
    const decodedClaims = await adminAuth.verifySessionCookie(
      sessionCookie,
      true // checkRevoked — forces check against Firebase Auth backend
    );

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          uid: decodedClaims.uid,
          email: decodedClaims.email,
          name: decodedClaims.name || null,
          picture: decodedClaims.picture || null,
          emailVerified: decodedClaims.email_verified || false,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Session verification error:", error);
    return NextResponse.json(
      { authenticated: false, error: "Invalid or expired session" },
      { status: 401 }
    );
  }
}
