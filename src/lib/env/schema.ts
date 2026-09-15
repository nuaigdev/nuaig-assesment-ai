import { z } from "zod";

// Spec §15. Validated at build (next.config.ts) and at server boot (instrumentation.ts)
// so a missing key fails the deploy, not a live call.
//
// Keys for services that arrive in later phases are optional until that phase lands.
// When a phase starts using a service, make its keys required — and read them only via
// `env` (src/lib/env/server.ts), never `process.env` directly.

const url = z.url();
const secret = z.string().min(1);
const intFromString = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

/** ES256 private JWK, as printed by `npx supabase gen signing-key --algorithm ES256`. */
const signingKeyJwk = z
  .string()
  .transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "must be a JSON Web Key (JSON string)" });
      return z.NEVER;
    }
  })
  .pipe(
    z.looseObject({
      kty: z.literal("EC"),
      crv: z.literal("P-256"),
      kid: z.string().min(1),
      d: z.string().min(1, "must be the private key (include `d`)"),
      x: z.string().min(1),
      y: z.string().min(1),
    }),
  );

export const publicEnvSchema = z.object({
  // Production origin; Microsoft redirects to `${NEXT_PUBLIC_APP_URL}/auth/callback`.
  NEXT_PUBLIC_APP_URL: url,
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
});

export const serverEnvSchema = publicEnvSchema.extend({
  // Supabase
  SUPABASE_SERVICE_ROLE_KEY: secret,
  // Private half of the signing key imported into Supabase (Settings → JWT Keys).
  // The app signs per-request access tokens with it so RLS sees auth.uid() = users.id.
  SUPABASE_JWT_SIGNING_KEY: signingKeyJwk,

  // Microsoft Entra ID (single-tenant app registration) — identity only: name + email.
  // The directory GUID, not a domain: the ID token issuer is checked against it.
  AZURE_TENANT_ID: z.guid("must be the directory (tenant) ID GUID"),
  AZURE_CLIENT_ID: secret,
  AZURE_CLIENT_SECRET: secret,

  // Signs the app's session cookie. Rotating it signs everyone out.
  SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),

  // LiveKit Cloud — the call room (Phase 2). The API key/secret mint tokens server-side only.
  LIVEKIT_URL: z.url().refine((value) => /^wss?:\/\//.test(value), "must be the wss:// URL of the LiveKit project"),
  LIVEKIT_API_KEY: secret,
  LIVEKIT_API_SECRET: secret,

  // Worker ⇄ app shared secret, ElevenLabs — required from Phase 3
  AGENT_WORKER_SECRET: z.string().min(32).optional(),
  ELEVENLABS_API_KEY: secret.optional(),
  ELEVENLABS_VOICE_ID: secret.optional(),
  ELEVENLABS_AGENT_ID: secret.optional(),

  // Anthropic — required from Phase 4
  ANTHROPIC_API_KEY: secret.optional(),

  // Behaviour defaults
  INTERVIEW_TIME_CAP_MINUTES: intFromString(45),
  INTERVIEW_INACTIVITY_SECONDS: intFromString(90),
  INVITATION_EXPIRY_DAYS: intFromString(7),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration (see spec §15 and .env.example):\n${problems}`,
    );
  }
  return result.data;
}
