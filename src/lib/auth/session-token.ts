import { SignJWT, jwtVerify } from "jose";

// No "server-only" import: src/proxy.ts verifies sessions too. Never import from client code.

export const SESSION_COOKIE = "nuaig_session";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

const ISSUER = "nuaig-portal";
const AUDIENCE = "nuaig-console";

const encode = (secret: string) => new TextEncoder().encode(secret);

/** The app session: a signed cookie naming a `users.id`. Access is re-checked against the table on every request. */
export function signSessionToken(userId: string, secret: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(encode(secret));
}

/** Returns the user id for a valid, unexpired session token, otherwise null. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encode(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
