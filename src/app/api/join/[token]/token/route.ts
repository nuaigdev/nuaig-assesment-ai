import type { NextRequest } from "next/server";

import { env } from "@/lib/env/server";
import { jsonNoStore, problem } from "@/lib/http";
import { isJoinable, prepareRoom } from "@/lib/interviews/call";
import { resolveJoinToken } from "@/lib/join/resolve";
import { isTooEarly } from "@/lib/join/timing";
import { INTERVIEWEE_IDENTITY, createCallToken } from "@/lib/livekit/server";
import { clientIp } from "@/lib/request";

/** Mints the interviewee's publisher token (spec §10.1). Microphone only. */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/join/[token]/token">) {
  const { token } = await params;
  const result = await resolveJoinToken(token, clientIp(request.headers));

  if (result.state === "rate_limited") return problem(429, "Too many attempts. Please wait a few minutes.");
  if (result.state === "ended") return problem(410, "This interview has ended.");
  if (result.state === "invalid") return problem(404, "This link isn’t valid anymore.");

  const { session } = result;
  if (!isJoinable(session.status)) return problem(409, "This interview isn’t open for joining.");
  if (isTooEarly(session.scheduledAt)) {
    return problem(409, "It’s a little early. You can join from 15 minutes before the start.");
  }

  const roomName = await prepareRoom(session.interviewId);
  const participantToken = await createCallToken({
    roomName,
    identity: INTERVIEWEE_IDENTITY,
    name: session.intervieweeName ?? "Interviewee",
    role: "interviewee",
  });
  return jsonNoStore({ serverUrl: env.LIVEKIT_URL, participantToken });
}
