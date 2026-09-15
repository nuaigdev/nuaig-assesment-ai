"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { databaseErrorMessage, failure, invalid, readForm, success, type ActionState } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { createUserClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  role: z.enum(["admin", "member"], "Choose a role."),
});

/**
 * Grants a NuAIg staff member access (spec §11.9). They sign in with Microsoft using this email;
 * the Microsoft account is linked on their first sign-in. The audit trigger records the invite.
 */
export async function inviteTeamMember(_state: unknown, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = inviteSchema.safeParse(readForm(formData, ["email", "role"]));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await createUserClient(admin.id)
    .from("users")
    .insert({ email: parsed.data.email, role: parsed.data.role, invited_by: admin.id });
  if (error?.code === "23505") {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { email: "This email already has access. Change their role or reactivate them from the list." },
    };
  }
  if (error) return failure(databaseErrorMessage(error));

  revalidatePath("/team");
  return success(`Access granted to ${parsed.data.email}`);
}

export async function setTeamMemberRole(userId: string, role: "admin" | "member"): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(userId) || (role !== "admin" && role !== "member")) return failure("Team member not found.");

  // The database refuses to demote the last active admin.
  const { error } = await createUserClient(admin.id).from("users").update({ role }).eq("id", userId);
  if (error) return failure(databaseErrorMessage(error));

  revalidatePath("/team");
  if (userId === admin.id && role === "member") redirect("/");
  return success(role === "admin" ? "Now an admin" : "Now a team member");
}

export async function setTeamMemberActive(userId: string, active: boolean): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(userId)) return failure("Team member not found.");

  // The database refuses to deactivate the last active admin. Deactivation takes effect on
  // their next request, because every request re-reads the users row.
  const { error } = await createUserClient(admin.id)
    .from("users")
    .update({ is_active: active === true })
    .eq("id", userId);
  if (error) return failure(databaseErrorMessage(error));

  revalidatePath("/team");
  if (userId === admin.id && !active) redirect("/auth/signout?reason=deactivated");
  return success(active ? "Access restored" : "Access removed");
}
