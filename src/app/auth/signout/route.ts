import { NextResponse, type NextRequest } from "next/server";

import { shouldUseSecureCookies } from "@/lib/auth/oidc";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session-token";

const REASONS = new Set(["not_staff", "deactivated"]);

function signOut(request: NextRequest, reason: string | null) {
  const url = new URL("/login", request.url);
  if (reason && REASONS.has(reason)) {
    url.searchParams.set("error", reason);
  }
  const response = NextResponse.redirect(url, { status: 303 });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(shouldUseSecureCookies()),
    maxAge: 0,
  });
  return response;
}

/** User menu "Sign out". Ends the portal session only (not the Microsoft session). */
export async function POST(request: NextRequest) {
  return signOut(request, null);
}

/**
 * Forced sign-out when a session's user is missing or deactivated (see requireUser).
 * Never link to this route — link prefetching would sign the user out.
 */
export async function GET(request: NextRequest) {
  return signOut(request, request.nextUrl.searchParams.get("reason"));
}
