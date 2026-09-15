"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  databaseErrorMessage,
  failure,
  fieldErrorsFrom,
  readForm,
  success,
  type ActionState,
} from "@/lib/actions";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { generateJoinToken, hashJoinToken, invitationExpiry, joinUrl } from "@/lib/join/token";
import { createUserClient } from "@/lib/supabase/server";

const teamSchema = z
  .array(z.object({ user_id: z.uuid(), role: z.enum(["steward", "observer"]) }), "Choose the team.")
  .refine((team) => team.filter((member) => member.role === "steward").length <= 1, "Choose at most one steward.")
  .refine((team) => new Set(team.map((member) => member.user_id)).size === team.length, "Each person can be assigned once.");

function parseTeam(formData: FormData) {
  let value: unknown = null;
  try {
    value = JSON.parse(String(formData.get("team") ?? "[]"));
  } catch {
    // Falls through to a validation error.
  }
  return teamSchema.safeParse(value);
}

const interviewSchema = z.object({
  assessment_id: z.uuid("Choose an assessment."),
  contact_id: z.uuid("Choose the interviewee."),
  template_id: z
    .string()
    .refine((value) => value === "" || isUuid(value), "Choose a template.")
    .transform((value) => value || undefined),
  department: z.string().trim().min(1, "Enter the department.").max(80, "Keep it under 80 characters."),
  scheduled_at: z.iso.datetime({ error: "Choose a date and time." }),
});
const INTERVIEW_FIELDS = ["assessment_id", "contact_id", "template_id", "department", "scheduled_at"] as const;

function revalidateInterviews(interviewId?: string) {
  revalidatePath("/");
  revalidatePath("/interviews");
  if (interviewId) revalidatePath(`/interviews/${interviewId}`);
}

/** Schedules an interview with its team in one transaction (create_interview). */
export async function createInterview(_state: unknown, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const fields = interviewSchema.safeParse(readForm(formData, INTERVIEW_FIELDS));
  const team = parseTeam(formData);

  if (!fields.success || !team.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: {
        ...(fields.success ? {} : fieldErrorsFrom(fields.error)),
        ...(team.success ? {} : { team: team.error.issues[0]?.message ?? "Check the team." }),
      },
    };
  }

  const { data: interviewId, error } = await createUserClient(admin.id).rpc("create_interview", {
    p_assessment_id: fields.data.assessment_id,
    p_contact_id: fields.data.contact_id,
    p_template_id: fields.data.template_id,
    p_department: fields.data.department,
    p_scheduled_at: fields.data.scheduled_at,
    p_team: team.data,
  });
  if (error) return failure(databaseErrorMessage(error));

  revalidateInterviews();
  redirect(`/interviews/${interviewId}?created=1`);
}

export async function updateInterviewTeam(
  interviewId: string,
  _state: unknown,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(interviewId)) return failure("Interview not found.");
  const team = parseTeam(formData);
  if (!team.success) {
    return {
      status: "error",
      message: team.error.issues[0]?.message ?? "Check the team.",
      fieldErrors: { team: team.error.issues[0]?.message ?? "Check the team." },
    };
  }

  const { error } = await createUserClient(admin.id).rpc("set_interview_team", {
    p_interview_id: interviewId,
    p_team: team.data,
  });
  if (error) return failure(databaseErrorMessage(error));

  revalidateInterviews(interviewId);
  return success("Team updated");
}

/**
 * Issues (or reissues) the interview's magic link (spec §7.4). The raw token is returned to the
 * browser exactly once and never stored; only its sha256 hash reaches the database.
 */
export async function issueJoinLink(interviewId: string): Promise<ActionState<{ url: string }>> {
  const admin = await requireAdmin();
  if (!isUuid(interviewId)) return failure("Interview not found.");
  const db = createUserClient(admin.id);

  const { data: interview, error: lookupError } = await db
    .from("interviews")
    .select("scheduled_at")
    .eq("id", interviewId)
    .maybeSingle();
  if (lookupError) return failure(databaseErrorMessage(lookupError));
  if (!interview) return failure("Interview not found.");

  const token = generateJoinToken();
  const { error } = await db.rpc("issue_invitation", {
    p_interview_id: interviewId,
    p_token_hash: hashJoinToken(token),
    p_expires_at: invitationExpiry(interview.scheduled_at, new Date()).toISOString(),
  });
  if (error) return failure(databaseErrorMessage(error));

  revalidateInterviews(interviewId);
  return success("Join link generated", { url: joinUrl(token) });
}

export async function revokeJoinLink(interviewId: string): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(interviewId)) return failure("Interview not found.");

  const { error } = await createUserClient(admin.id).rpc("revoke_invitation", {
    p_interview_id: interviewId,
  });
  if (error) return failure(databaseErrorMessage(error));

  revalidateInterviews(interviewId);
  return success("Join link revoked");
}
