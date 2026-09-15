import "server-only";

import { SignJWT, jwtVerify } from "jose";
import * as client from "openid-client";

import { env } from "@/lib/env/server";

/**
 * Microsoft Entra ID sign-in (OIDC authorization code + PKCE), handled by the app itself.
 * Microsoft is used for identity only — object id, name, email. Whether that person may use
 * the portal, and with what role, is decided by the `users` table (see admit.ts).
 */

export const OIDC_COOKIE = "nuaig_oidc";
export const CALLBACK_PATH = "/auth/callback";
const OIDC_MAX_AGE_SECONDS = 10 * 60;
const TRANSACTION_AUDIENCE = "nuaig-oidc";

export type MicrosoftIdentity = { oid: string; email: string; name: string | null };

let configPromise: Promise<client.Configuration> | undefined;

function getConfig() {
  configPromise ??= client
    .discovery(
      // Tenant-specific v2.0 endpoint: tokens from other directories fail issuer validation.
      new URL(`https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/v2.0`),
      env.AZURE_CLIENT_ID,
      env.AZURE_CLIENT_SECRET,
    )
    .catch((error: unknown) => {
      configPromise = undefined;
      throw error;
    });
  return configPromise;
}

/** Registered in Azure as the Web redirect URI. Always the canonical app URL. */
export function redirectUri() {
  return new URL(CALLBACK_PATH, env.NEXT_PUBLIC_APP_URL).toString();
}

export function shouldUseSecureCookies() {
  return env.NEXT_PUBLIC_APP_URL.startsWith("https://");
}

const transactionKey = () => new TextEncoder().encode(env.SESSION_SECRET);

/** Builds the Microsoft authorize URL and the signed, short-lived transaction cookie value. */
export async function startSignIn(next: string) {
  const config = await getConfig();
  const codeVerifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri(),
    scope: "openid profile email",
    response_mode: "query",
    code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: "S256",
    state,
    nonce,
    prompt: "select_account",
  });

  const transaction = await new SignJWT({ state, nonce, codeVerifier, next })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(TRANSACTION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${OIDC_MAX_AGE_SECONDS}s`)
    .sign(transactionKey());

  return {
    url: url.toString(),
    transaction,
    cookieOptions: {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: "lax" as const,
      path: CALLBACK_PATH,
      maxAge: OIDC_MAX_AGE_SECONDS,
    },
  };
}

/**
 * Validates the Microsoft response (state, nonce, PKCE, ID token signature/issuer/audience)
 * and returns who signed in. Throws on any failure.
 */
export async function completeSignIn(
  search: string,
  transactionToken: string | undefined,
): Promise<{ identity: MicrosoftIdentity; next: string }> {
  if (!transactionToken) {
    throw new Error("Sign-in transaction cookie missing or expired");
  }
  const { payload } = await jwtVerify(transactionToken, transactionKey(), {
    audience: TRANSACTION_AUDIENCE,
    algorithms: ["HS256"],
  });
  const { state, nonce, codeVerifier, next } = payload;
  if (
    typeof state !== "string" ||
    typeof nonce !== "string" ||
    typeof codeVerifier !== "string" ||
    typeof next !== "string"
  ) {
    throw new Error("Malformed sign-in transaction");
  }

  const config = await getConfig();
  // Rebuild the callback URL on the canonical origin so the derived redirect_uri matches
  // what was sent to Microsoft, regardless of proxy host headers.
  const tokens = await client.authorizationCodeGrant(config, new URL(`${redirectUri()}${search}`), {
    pkceCodeVerifier: codeVerifier,
    expectedState: state,
    expectedNonce: nonce,
    idTokenExpected: true,
  });

  const claims = tokens.claims();
  if (!claims || typeof claims.oid !== "string" || typeof claims.tid !== "string") {
    throw new Error("ID token is missing oid/tid");
  }
  if (claims.tid.toLowerCase() !== env.AZURE_TENANT_ID.toLowerCase()) {
    throw new Error("ID token is from a different tenant");
  }

  // `email` is optional in Entra; the UPN (preferred_username) is the fallback.
  const email = [claims.email, claims.preferred_username].find(
    (value): value is string => typeof value === "string" && value.includes("@"),
  );
  if (!email) {
    throw new Error("ID token has no email or UPN");
  }

  return {
    identity: {
      oid: claims.oid,
      email: email.trim().toLowerCase(),
      name: typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : null,
    },
    next,
  };
}
