import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env/server";

import type { Database } from "./database.types";
import { signSupabaseAccessToken } from "./token";

/**
 * Client acting as a NuAIg staff member: every request carries an app-signed access token,
 * so RLS applies with auth.uid() = userId. The default for console reads and writes.
 * Get `userId` from requireUser()/requireAdmin() — never from request input.
 */
export function createUserClient(userId: string) {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    accessToken: () => signSupabaseAccessToken(userId),
  });
}
