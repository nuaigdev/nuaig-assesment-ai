import { z } from "zod";

import { getActiveUser } from "@/lib/auth/session";
import { problem } from "@/lib/http";
import { isUuid } from "@/lib/ids";
import { loadStaffCall, recordPresence } from "@/lib/interviews/call";
import { isInRoom, removeFromRoom, roomNameFor, staffIdentity } from "@/lib/livekit/server";

const bodySchema = z.object({ present: z.boolean() });

/** A steward or observer reports joining or leaving; joins are confirmed with LiveKit first. */
export async function POST(request: Request, { params }: RouteContext<"/api/interviews/[id]/presence">) {
  const user = await getActiveUser();
  if (!user) return problem(401, "Sign in to join the call.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return problem(400, "Invalid request.");

  const { id } = await params;
  if (!isUuid(id)) return problem(404, "Interview not found.");
  const call = await loadStaffCall(user, id);
  if (!call?.role) return problem(404, "Interview not found.");

  const roomName = roomNameFor(id);
  const identity = staffIdentity(user.id);
  const subject = { role: call.role, userId: user.id } as const;

  if (body.data.present) {
    if (!(await isInRoom(roomName, identity))) return problem(409, "Not connected to the call.");
    await recordPresence(id, subject, true);
  } else {
    await removeFromRoom(roomName, identity);
    await recordPresence(id, subject, false);
  }
  return new Response(null, { status: 204 });
}
