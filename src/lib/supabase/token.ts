import "server-only";

import { SignJWT, importJWK, type JWK } from "jose";

import { env } from "@/lib/env/server";

const DEFAULT_TTL_SECONDS = 5 * 60;

let signingKey: ReturnType<typeof importJWK> | undefined;

/**
 * Signs a Supabase access token for a staff member with the key imported into the Supabase
 * project. PostgREST/Realtime verify it like a Supabase Auth token, so RLS sees
 * auth.uid() = users.id and role = authenticated.
 */
export async function signSupabaseAccessToken(userId: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const jwk = env.SUPABASE_JWT_SIGNING_KEY;
  // The CLI emits key_ops ["sign","verify"]; WebCrypto rejects "verify" on a private key,
  // so import only the key material.
  signingKey ??= importJWK({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d } as JWK, "ES256");

  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "ES256", kid: jwk.kid, typ: "JWT" })
    .setSubject(userId)
    .setAudience("authenticated")
    .setIssuer(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(await signingKey);
}
