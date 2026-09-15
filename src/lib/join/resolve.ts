import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InterviewStatus } from "@/lib/supabase/types";

import { JOIN_TOKEN_PATTERN, hashJoinToken } from "./token";

// Per IP, per window. Generous for a real client (page refreshes, the waiting-room poll),
// far too slow for guessing a 256-bit token.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

export type JoinTeamMember = { name: string; role: "steward" | "observer" };

/** What an interviewee may see about their interview. No staff emails, no ids beyond the interview. */
export type JoinSession = {
  interviewId: string;
  organizationName: string;
  department: string;
  intervieweeName: string | null;
  scheduledAt: string | null;
  status: InterviewStatus;
  expectedMinutes: number;
  team: JoinTeamMember[];
};

export type JoinResolution =
  | { state: "ok"; session: JoinSession }
  | { state: "invalid" }
  | { state: "ended" }
  | { state: "rate_limited" };

function expectedMinutes(config: unknown): number {
  if (config && typeof config === "object" && !Array.isArray(config)) {
    const minutes = (config as Record<string, unknown>).time_cap_minutes;
    if (typeof minutes === "number" && minutes > 0) return minutes;
  }
  return env.INTERVIEW_TIME_CAP_MINUTES;
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

/**
 * Validates a magic-link token (spec §7.4) with the service role; interviewees are never
 * database principals. Rate-limited by IP before any lookup. Reusable until it expires or is
 * revoked; the first use is recorded but does not burn the token.
 */
export async function resolveJoinToken(token: string, ip: string | null): Promise<JoinResolution> {
  const db = createAdminClient();

  const { data: allowed, error: limitError } = await db.rpc("consume_rate_limit", {
    p_key: `join:${createHash("sha256").update(ip ?? "unknown").digest("hex")}`,
    p_limit: RATE_LIMIT_MAX,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (limitError) throw new Error(`Rate limiter failed: ${limitError.message}`);
  if (!allowed) return { state: "rate_limited" };

  if (!JOIN_TOKEN_PATTERN.test(token)) return { state: "invalid" };

  const { data: invitation, error } = await db
    .from("invitations")
    .select(
      "id, expires_at, revoked_at, first_used_at, interviews(id, department, status, scheduled_at, organizations(name), contacts(full_name), templates(config), interview_participants(role, users(full_name)))",
    )
    .eq("token_hash", hashJoinToken(token))
    .maybeSingle();
  if (error) throw new Error(`Looking up join link failed: ${error.message}`);

  const interview = invitation?.interviews;
  if (!invitation || !interview) return { state: "invalid" };
  if (interview.status === "completed") return { state: "ended" };
  if (
    invitation.revoked_at ||
    isExpired(invitation.expires_at) ||
    interview.status === "cancelled" ||
    interview.status === "failed"
  ) {
    return { state: "invalid" };
  }

  if (!invitation.first_used_at) {
    const { error: markError } = await db
      .from("invitations")
      .update({ first_used_at: new Date().toISOString() })
      .eq("id", invitation.id)
      .is("first_used_at", null);
    if (markError) throw new Error(`Recording link use failed: ${markError.message}`);
  }

  const team = interview.interview_participants
    .flatMap((participant): JoinTeamMember[] =>
      participant.role === "steward" || participant.role === "observer"
        ? [{ name: participant.users?.full_name ?? "NuAIg team member", role: participant.role }]
        : [],
    )
    .sort((a, b) => Number(b.role === "steward") - Number(a.role === "steward"));

  return {
    state: "ok",
    session: {
      interviewId: interview.id,
      organizationName: interview.organizations?.name ?? "NuAIg",
      department: interview.department,
      intervieweeName: interview.contacts?.full_name ?? null,
      scheduledAt: interview.scheduled_at,
      status: interview.status,
      expectedMinutes: expectedMinutes(interview.templates?.config),
      team,
    },
  };
}
