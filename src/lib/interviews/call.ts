import "server-only";

import { closeRoom, ensureRoom, roomNameFor } from "@/lib/livekit/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";
import type { AppUser, EndReason, InterviewStatus } from "@/lib/supabase/types";

/** Upstream failures can return whole HTML error pages; keep logged messages readable. */
function describe(error: { message: string }): string {
  return error.message.replace(/\s+/g, " ").slice(0, 200);
}

/** A call can be joined once a link exists (ready) and until it ends. */
export function isJoinable(status: InterviewStatus): boolean {
  return status === "ready" || status === "live";
}

export type StaffCall = {
  interview: {
    id: string;
    title: string;
    status: InterviewStatus;
    intervieweeName: string | null;
  };
  /** null: may see the interview but not join the call. */
  role: "steward" | "observer" | null;
  canEnd: boolean;
};

/**
 * What a staff member may do on an interview's call. Assigned staff join in their assigned role;
 * admins who aren't assigned join as observers. Stewards and admins can end the call (§12.3).
 * Reads through RLS, so members only ever see interviews they're assigned to.
 */
export async function loadStaffCall(user: AppUser, interviewId: string): Promise<StaffCall | null> {
  const { data, error } = await createUserClient(user.id)
    .from("interviews")
    .select("id, title, status, contacts(full_name), interview_participants(user_id, role)")
    .eq("id", interviewId)
    .maybeSingle();
  if (error) throw new Error(`Loading call: ${describe(error)}`);
  if (!data) return null;

  const assigned = data.interview_participants.find((participant) => participant.user_id === user.id);
  const assignedRole = assigned?.role === "steward" || assigned?.role === "observer" ? assigned.role : null;
  const role = assignedRole ?? (user.role === "admin" ? "observer" : null);

  return {
    interview: {
      id: data.id,
      title: data.title,
      status: data.status,
      intervieweeName: data.contacts?.full_name ?? null,
    },
    role,
    canEnd: role !== null && (assignedRole === "steward" || user.role === "admin"),
  };
}

/** Creates the LiveKit room for an interview (idempotent) and records its name. */
export async function prepareRoom(interviewId: string): Promise<string> {
  const roomName = roomNameFor(interviewId);
  await ensureRoom(roomName);
  const { error } = await createAdminClient()
    .from("interviews")
    .update({ livekit_room: roomName })
    .eq("id", interviewId)
    .is("livekit_room", null);
  if (error) throw new Error(`Recording room: ${describe(error)}`);
  return roomName;
}

type PresenceSubject =
  | { role: "interviewee" | "agent" }
  | { role: "steward" | "observer"; userId: string };

/**
 * Records a join or leave. Call only after confirming it with LiveKit (join) or making it
 * happen (leave). The interviewee joining moves a ready interview to live.
 */
export async function recordPresence(
  interviewId: string,
  subject: PresenceSubject,
  present: boolean,
): Promise<void> {
  const userId = "userId" in subject ? subject.userId : null;
  const { error } = await createAdminClient().rpc("record_participant_presence", {
    p_interview_id: interviewId,
    p_role: subject.role,
    // Nullable in Postgres; the generated types don't model nullable arguments.
    p_user_id: userId as string,
    p_present: present,
    p_actor: userId ?? undefined,
  });
  if (error) throw new Error(`Recording presence: ${describe(error)}`);
}

/**
 * The unified teardown (spec §13.1). EVERY way a call ends must come through here; never
 * re-implement these steps per path. Returns the final status, or null if already finished.
 *
 *   1. Graceful close by the agent                      Phase 3
 *   2. Flush the transcript and mark entries final      Phase 3
 *   3. Write ended_at, duration_seconds, end_reason     ✓ finalize_interview
 *   4. Finalize and store the recording                 Phase 6
 *   5. Set status completed / cancelled / failed         ✓ finalize_interview
 *   6. Disconnect the worker and close the room          ✓ room (worker: Phase 3)
 *   7. Invalidate the magic link                         ✓ finalize_interview
 */
export async function teardownInterview(
  interviewId: string,
  reason: EndReason,
  options: { actorId?: string; failed?: boolean } = {},
): Promise<InterviewStatus | null> {
  const { data: status, error } = await createAdminClient().rpc("finalize_interview", {
    p_interview_id: interviewId,
    p_reason: reason,
    p_failed: options.failed ?? false,
    p_actor: options.actorId,
  });
  if (error) throw new Error(`Finalizing interview: ${describe(error)}`);

  // Closing the room disconnects everyone; their clients take them to the ended screens.
  await closeRoom(roomNameFor(interviewId));
  return status;
}
