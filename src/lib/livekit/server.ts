import "server-only";

import { AccessToken, AgentDispatchClient, RoomServiceClient, TrackSource } from "livekit-server-sdk";

import { env } from "@/lib/env/server";

/** The interviewee's fixed identity. The Phase 3 worker subscribes to this identity only (spec §4.4). */
export const INTERVIEWEE_IDENTITY = "interviewee";
/** The AI agent's identity (Phase 3). */
export const AGENT_IDENTITY = "agent";
/** The worker registers under this name and joins only rooms it is explicitly dispatched to. */
export const AGENT_NAME = "nuaig-interviewer";

export type CallRole = "interviewee" | "steward" | "observer";

export function staffIdentity(userId: string): string {
  return `staff-${userId}`;
}

export function roomNameFor(interviewId: string): string {
  return `interview-${interviewId}`;
}

let roomService: RoomServiceClient | undefined;

function rooms(): RoomServiceClient {
  // The server API takes the https:// form of the project URL.
  roomService ??= new RoomServiceClient(
    env.LIVEKIT_URL.replace(/^ws/, "http"),
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );
  return roomService;
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, code, message } = error as { status?: number; code?: string; message?: string };
  return status === 404 || code === "not_found" || /not found|does not exist/i.test(message ?? "");
}

/** Creates the room if it doesn't exist yet. Returns once LiveKit has it. */
export async function ensureRoom(roomName: string): Promise<void> {
  await rooms().createRoom({
    name: roomName,
    emptyTimeout: 15 * 60,
    departureTimeout: 5 * 60,
    maxParticipants: 16,
  });
}

/**
 * A short-lived join token. Listen-only is enforced here, not in the UI (spec §6.2): staff
 * can't publish any track or data, and nobody can change their own name or role.
 */
export async function createCallToken({
  roomName,
  identity,
  name,
  role,
}: {
  roomName: string;
  identity: string;
  name: string;
  role: CallRole;
}): Promise<string> {
  const canSpeak = role === "interviewee";
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: "2h",
    attributes: { role },
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canSubscribe: true,
    canPublish: canSpeak,
    canPublishSources: canSpeak ? [TrackSource.MICROPHONE] : [],
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return token.toJwt();
}

/** Whether LiveKit currently has this identity connected to the room. */
export async function isInRoom(roomName: string, identity: string): Promise<boolean> {
  try {
    await rooms().getParticipant(roomName, identity);
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

export async function removeFromRoom(roomName: string, identity: string): Promise<void> {
  try {
    await rooms().removeParticipant(roomName, identity);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

let dispatchService: AgentDispatchClient | undefined;

/**
 * Sends the agent worker into the room (explicit dispatch, spec §6.1). Idempotent: an existing
 * dispatch for this room is reused. The job metadata tells the worker which interview it serves.
 */
export async function dispatchAgent(roomName: string, interviewId: string): Promise<void> {
  dispatchService ??= new AgentDispatchClient(
    env.LIVEKIT_URL.replace(/^ws/, "http"),
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );
  const existing = await dispatchService.listDispatch(roomName);
  if (existing.some((dispatch) => dispatch.agentName === AGENT_NAME)) return;
  await dispatchService.createDispatch(roomName, AGENT_NAME, {
    metadata: JSON.stringify({ interviewId }),
  });
}

/** Deletes the room, disconnecting everyone in it. */
export async function closeRoom(roomName: string): Promise<void> {
  try {
    await rooms().deleteRoom(roomName);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}
