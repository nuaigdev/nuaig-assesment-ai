import { getActiveUser } from "@/lib/auth/session";
import { env } from "@/lib/env/server";
import { jsonNoStore, problem } from "@/lib/http";
import { isUuid } from "@/lib/ids";
import { isJoinable, loadStaffCall, prepareRoom } from "@/lib/interviews/call";
import { createCallToken, staffIdentity } from "@/lib/livekit/server";

/** Mints a listen-only token for a steward or observer (spec §10.1). */
export async function POST(_request: Request, { params }: RouteContext<"/api/interviews/[id]/token">) {
  const user = await getActiveUser();
  if (!user) return problem(401, "Sign in to join the call.");

  const { id } = await params;
  if (!isUuid(id)) return problem(404, "Interview not found.");
  const call = await loadStaffCall(user, id);
  if (!call) return problem(404, "Interview not found.");
  if (!call.role) return problem(403, "You’re not assigned to this interview.");
  if (!isJoinable(call.interview.status)) {
    return problem(409, "This call isn’t open. Generate a join link first; finished interviews can’t be rejoined.");
  }

  const roomName = await prepareRoom(id);
  const participantToken = await createCallToken({
    roomName,
    identity: staffIdentity(user.id),
    name: user.full_name ?? user.email,
    role: call.role,
  });
  return jsonNoStore({ serverUrl: env.LIVEKIT_URL, participantToken });
}
