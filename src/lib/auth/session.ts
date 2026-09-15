import "server-only";

import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { env } from "@/lib/env/server";
import type { AppUser } from "@/lib/supabase/types";
import { createUserClient } from "@/lib/supabase/server";

import { SESSION_COOKIE, verifySessionToken } from "./session-token";

type CurrentUser = { userId: string | null; user: AppUser | null };

/**
 * The signed-in staff member, memoised per request. The `users` row is re-read every
 * request, so deactivation and role changes apply immediately, not at session expiry.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = await verifySessionToken(token, env.SESSION_SECRET);
  if (!userId) {
    return { userId: null, user: null };
  }

  const { data, error } = await createUserClient(userId)
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Loading user failed: ${error.message}`);
  }
  return { userId, user: data };
});

/** Guard for console pages and actions: an active `users` row, or out. Call it in every page, not only layouts. */
export async function requireUser(): Promise<AppUser> {
  const { userId, user } = await getCurrentUser();
  if (!userId) redirect("/login");
  if (!user) redirect("/auth/signout?reason=not_staff");
  if (!user.is_active) redirect("/auth/signout?reason=deactivated");
  return user;
}

/** Guard for admin-only pages (spec §8). RLS still enforces the same boundary underneath. */
export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== "admin") forbidden();
  return user;
}
