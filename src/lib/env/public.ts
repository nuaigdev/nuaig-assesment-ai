import { parseEnv, publicEnvSchema } from "./schema";

// NEXT_PUBLIC_* values are inlined at build time, so each must be referenced literally.
export const publicEnv = parseEnv(publicEnvSchema, {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
