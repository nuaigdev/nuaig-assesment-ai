import { NextResponse, type NextRequest } from "next/server";

import { admitUser } from "@/lib/auth/admit";
import {
  CALLBACK_PATH,
  OIDC_COOKIE,
  completeSignIn,
  shouldUseSecureCookies,
} from "@/lib/auth/oidc";
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken } from "@/lib/auth/session-token";
import { env } from "@/lib/env/server";

function clearTransaction(response: NextResponse) {
  response.cookies.set(OIDC_COOKIE, "", { path: CALLBACK_PATH, maxAge: 0 });
  return response;
}

function toLogin(request: NextRequest, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return clearTransaction(NextResponse.redirect(url));
}

/**
 * Microsoft redirects here (the Azure app's redirect URI: `${NEXT_PUBLIC_APP_URL}/auth/callback`).
 * Microsoft proves who the person is; the `users` table decides whether they get in (admit.ts).
 */
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("error")) {
    return toLogin(request, "sso_failed");
  }

  let signIn: Awaited<ReturnType<typeof completeSignIn>>;
  try {
    signIn = await completeSignIn(request.nextUrl.search, request.cookies.get(OIDC_COOKIE)?.value);
  } catch (error) {
    console.error("Microsoft sign-in failed", error);
    return toLogin(request, "sso_failed");
  }

  let admission: Awaited<ReturnType<typeof admitUser>>;
  try {
    admission = await admitUser(signIn.identity);
  } catch (error) {
    console.error("Admitting user failed", error);
    return toLogin(request, "server_error");
  }
  if (!admission.ok) {
    return toLogin(request, admission.reason);
  }

  const response = NextResponse.redirect(new URL(signIn.next, env.NEXT_PUBLIC_APP_URL));
  response.cookies.set(
    SESSION_COOKIE,
    await signSessionToken(admission.user.id, env.SESSION_SECRET),
    sessionCookieOptions(shouldUseSecureCookies()),
  );
  return clearTransaction(response);
}
