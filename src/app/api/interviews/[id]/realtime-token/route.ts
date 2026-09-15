import { getActiveUser } from "@/lib/auth/session";
import { jsonNoStore, problem } from "@/lib/http";
import { isUuid } from "@/lib/ids";
import { loadStaffCall } from "@/lib/interviews/call";
import { signSupabaseAccessToken } from "@/lib/supabase/token";

const TTL_SECONDS = 60 * 60;

/**
 * A short-lived Supabase access token for the live transcript (Realtime). It carries the staff
 * member's own identity, so Realtime applies the same RLS as every other read.
 */
export async function POST(_request: Request, { params }: RouteContext<"/api/interviews/[id]/realtime-token">) {
  const user = await getActiveUser();
  if (!user) return problem(401, "Sign in to follow the transcript.");

  const { id } = await params;
  if (!isUuid(id)) return problem(404, "Interview not found.");
  const call = await loadStaffCall(user, id);
  if (!call?.role) return problem(404, "Interview not found.");

  const token = await signSupabaseAccessToken(user.id, TTL_SECONDS);
  return jsonNoStore({ token, expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString() });
}
