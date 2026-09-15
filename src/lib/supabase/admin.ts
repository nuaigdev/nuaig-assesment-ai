import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env/server";

import type { Database } from "./database.types";

/**
 * Service-role client. Bypasses RLS — use only for work no user session can do
 * (magic-link validation, worker callbacks, health checks) and scope every query yourself.
 */
export function createAdminClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
