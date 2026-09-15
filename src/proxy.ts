import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session-token";
import { parseEnv, serverEnvSchema } from "@/lib/env/schema";

const { SESSION_SECRET } = parseEnv(serverEnvSchema.pick({ SESSION_SECRET: true }), process.env);

// Reachable without a NuAIg session: sign-in, clients (magic links), the worker, uptime checks.
const PUBLIC_PATHS = ["/login", "/auth", "/join", "/api/health", "/api/join", "/api/agent"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Cheap gate: a validly signed, unexpired session cookie. Pages still call requireUser(),
 * which checks the `users` row (active, role) on every request.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, SESSION_SECRET);
  if (userId) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
