import type { NextRequest } from "next/server";
import { z } from "zod";

import { problem } from "@/lib/http";
import { recordPresence } from "@/lib/interviews/call";
import { resolveJoinToken } from "@/lib/join/resolve";
import { INTERVIEWEE_IDENTITY, isInRoom, removeFromRoom, roomNameFor } from "@/lib/livekit/server";
import { clientIp } from "@/lib/request";

const bodySchema = z.object({ present: z.boolean() });

/**
 * The interviewee reports joining or leaving. A join is only recorded once LiveKit confirms the
 * interviewee is connected; a leave removes them from the room first. Also receives the
 * pagehide beacon when the tab closes.
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/join/[token]/presence">) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return problem(400, "Invalid request.");

  const { token } = await params;
  const result = await resolveJoinToken(token, clientIp(request.headers));
  if (result.state === "rate_limited") return problem(429, "Too many attempts. Please wait a few minutes.");
  // A finished interview already recorded everyone leaving.
  if (result.state === "ended") return new Response(null, { status: 204 });
  if (result.state === "invalid") return problem(404, "This link isn’t valid anymore.");

  const { interviewId } = result.session;
  const roomName = roomNameFor(interviewId);

  if (body.data.present) {
    if (!(await isInRoom(roomName, INTERVIEWEE_IDENTITY))) return problem(409, "Not connected to the call.");
    await recordPresence(interviewId, { role: "interviewee" }, true);
  } else {
    await removeFromRoom(roomName, INTERVIEWEE_IDENTITY);
    await recordPresence(interviewId, { role: "interviewee" }, false);
  }
  return new Response(null, { status: 204 });
}
