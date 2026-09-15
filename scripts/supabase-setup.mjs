#!/usr/bin/env node
// pnpm db:setup — one-time (idempotent) project configuration for the app's own staff auth:
//  1. Import SUPABASE_JWT_SIGNING_KEY into the project and make it the in-use signing key, so
//     PostgREST/Realtime accept the access tokens the app signs (src/lib/supabase/token.ts).
//  2. Lock down Supabase Auth, which the app doesn't use: no sign-ups, no email provider.
import { fail, loadEnv, managementApi, run } from "./lib/supabase-api.mjs";

run(async () => {
  const api = managementApi(loadEnv());

  let jwk;
  try {
    jwk = JSON.parse(process.env.SUPABASE_JWT_SIGNING_KEY ?? "");
  } catch {
    fail("SUPABASE_JWT_SIGNING_KEY must be the private JWK JSON (npx supabase gen signing-key --algorithm ES256).");
  }
  if (jwk.kty !== "EC" || !jwk.d || !jwk.kid) {
    fail("SUPABASE_JWT_SIGNING_KEY must be a private ES256 JWK with a kid.");
  }

  const { keys } = await api.call("/config/auth/signing-keys");
  let key = keys.find((k) => k.id === jwk.kid || k.public_jwk?.kid === jwk.kid);
  if (!key) {
    key = await api.call("/config/auth/signing-keys", {
      method: "POST",
      body: { algorithm: "ES256", status: "standby", private_jwk: jwk },
    });
    console.log(`✓ Imported app signing key ${jwk.kid}`);
  } else {
    console.log(`• App signing key ${jwk.kid} already imported (${key.status})`);
  }

  if (key.status !== "in_use") {
    await api.call(`/config/auth/signing-keys/${key.id}`, {
      method: "PATCH",
      body: { status: "in_use" },
    });
    console.log("✓ App signing key is now in use");
  }

  const { keys: after } = await api.call("/config/auth/signing-keys");
  console.table(after.map((k) => ({ id: k.id, algorithm: k.algorithm, status: k.status })));

  const auth = await api.call("/config/auth");
  const patch = {};
  if (!auth.disable_signup) patch.disable_signup = true;
  if (auth.external_email_enabled) patch.external_email_enabled = false;
  if (Object.keys(patch).length > 0) {
    await api.call("/config/auth", { method: "PATCH", body: patch });
    console.log("✓ Supabase Auth locked down:", patch);
  } else {
    console.log("• Supabase Auth already locked down");
  }
});
