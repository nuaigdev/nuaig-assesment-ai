import "server-only";

import type { AppUser } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";

import type { MicrosoftIdentity } from "./oidc";

export type AdmitResult =
  | { ok: true; user: AppUser }
  | { ok: false; reason: "not_staff" | "deactivated" | "account_mismatch" };

/**
 * Decides whether a Microsoft identity may use the portal, using only the `users` table.
 *
 * - Matched by Microsoft object id once bound (emails can be renamed or recycled).
 * - Otherwise matched by email, and the object id is bound on that first sign-in.
 * - An email row already bound to a different Microsoft account is refused.
 *
 * Runs with the service role: there is no session yet.
 */
export async function admitUser(identity: MicrosoftIdentity): Promise<AdmitResult> {
  const db = createAdminClient();

  const byOid = await db.from("users").select("*").eq("microsoft_oid", identity.oid).maybeSingle();
  if (byOid.error) throw new Error(`Looking up user by Microsoft id failed: ${byOid.error.message}`);

  let user = byOid.data;
  const firstSignIn = !user;

  if (!user) {
    const byEmail = await db.from("users").select("*").eq("email", identity.email).maybeSingle();
    if (byEmail.error) throw new Error(`Looking up user by email failed: ${byEmail.error.message}`);
    if (!byEmail.data) return { ok: false, reason: "not_staff" };
    if (byEmail.data.microsoft_oid && byEmail.data.microsoft_oid !== identity.oid) {
      return { ok: false, reason: "account_mismatch" };
    }
    user = byEmail.data;
  }

  if (!user.is_active) return { ok: false, reason: "deactivated" };

  let update = db
    .from("users")
    .update({
      microsoft_oid: identity.oid,
      full_name: identity.name ?? user.full_name,
      last_sign_in_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (firstSignIn) {
    // Don't overwrite a binding that a concurrent sign-in just made.
    update = update.is("microsoft_oid", null);
  }
  const updated = await update.select("*").single();
  if (updated.error) throw new Error(`Recording sign-in failed: ${updated.error.message}`);

  if (firstSignIn) {
    const audit = await db.from("audit_log").insert({
      user_id: user.id,
      action: "user.microsoft_linked",
      entity_type: "user",
      entity_id: user.id,
      metadata: { email: identity.email },
    });
    if (audit.error) throw new Error(`Writing audit log failed: ${audit.error.message}`);
  }

  return { ok: true, user: updated.data };
}
