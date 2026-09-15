import { AutoSubscribe, type JobContext } from "@livekit/agents";
import {
  AudioFrame,
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "@livekit/rtc-node";
import WebSocket from "ws";
import { z } from "zod";

import { AppApi, EventQueue } from "./app-api.js";
import { INPUT_SAMPLE_RATE, INTERVIEWEE_IDENTITY, OUTPUT_SAMPLE_RATE } from "./constants.js";
import { loadWorkerEnv } from "./env.js";
import { log } from "./log.js";

const metadataSchema = z.object({ interviewId: z.uuid() });

/** Interviewee audio is sent to ElevenLabs in ~50 ms chunks. */
const CHUNK_SAMPLES = INPUT_SAMPLE_RATE / 20;

/** The subset of Speech Engine conversation events the bridge uses. */
type ConversationEvent = {
  type?: string;
  conversation_initiation_metadata_event?: { conversation_id?: string };
  audio_event?: { audio_base_64?: string };
  user_transcription_event?: { user_transcript?: string };
  agent_response_event?: { agent_response?: string };
  agent_response_correction_event?: { corrected_agent_response?: string };
  ping_event?: { event_id?: number };
};

/**
 * Plays the agent's audio into the room. captureFrame calls must not overlap, so frames are
 * chained; an interruption bumps the generation so frames queued before it are dropped.
 */
class Playback {
  private generation = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly source: AudioSource) {}

  enqueue(base64: string): void {
    const bytes = Buffer.from(base64, "base64");
    const samples = new Int16Array(bytes.length >> 1);
    for (let index = 0; index < samples.length; index += 1) samples[index] = bytes.readInt16LE(index * 2);
    const frame = new AudioFrame(samples, OUTPUT_SAMPLE_RATE, 1, samples.length);
    const generation = this.generation;

    this.chain = this.chain
      .then(async () => {
        if (generation === this.generation) await this.source.captureFrame(frame);
      })
      .catch(() => undefined);
  }

  /** The interviewee started talking over the agent: stop immediately. */
  clear(): void {
    this.generation += 1;
    this.source.clearQueue();
  }
}

/**
 * A one-time URL for a Speech Engine conversation. A plain request rather than the ElevenLabs
 * SDK: job processes stay small and start fast on CPU-throttled hosts.
 */
async function signedConversationUrl(apiKey: string, engineId: string): Promise<string> {
  const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url");
  url.searchParams.set("agent_id", engineId);
  const response = await fetch(url, { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(10_000) });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`ElevenLabs signed URL failed (${response.status}): ${body.replace(/\s+/g, " ").slice(0, 200)}`);
  }
  const signedUrl = (JSON.parse(body) as { signed_url?: string }).signed_url;
  if (!signedUrl) throw new Error("ElevenLabs returned no signed URL");
  return signedUrl;
}

function pcmToBase64(chunks: Int16Array[], totalSamples: number): string {
  const merged = new Int16Array(totalSamples);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return Buffer.from(merged.buffer, merged.byteOffset, merged.byteLength).toString("base64");
}

/**
 * One interview's bridge (spec §4.2–4.4). Subscribes ONLY to the interviewee's audio (pinned
 * identity, so observers never reach the transcript), streams it to Speech Engine, publishes the
 * agent's synthesized voice as its own track, and reports transcripts and lifecycle to the app.
 */
export async function runBridge(ctx: JobContext): Promise<void> {
  const env = loadWorkerEnv();
  const { interviewId } = metadataSchema.parse(JSON.parse(ctx.job.metadata || "{}"));
  const api = new AppApi(env.APP_URL, env.AGENT_WORKER_SECRET);
  const events = new EventQueue(api, interviewId);
  const scope = log.child({ interviewId, room: ctx.room.name });

  let conversation: WebSocket | null = null;
  let playback: Playback | null = null;
  let ending = false;

  async function fail(reason: string): Promise<void> {
    if (ending) return;
    ending = true;
    scope.error("bridge failed", { reason });
    conversation?.close();
    events.push({ type: "failed", message: reason });
    await events.flush();
    ctx.shutdown(reason);
  }

  ctx.addShutdownCallback(async () => {
    ending = true;
    conversation?.close();
    events.push({ type: "agent_left" });
    await events.flush();
    scope.info("bridge stopped");
  });

  async function forwardInterviewee(track: RemoteTrack): Promise<void> {
    const stream = new AudioStream(track, INPUT_SAMPLE_RATE, 1);
    let buffered: Int16Array[] = [];
    let bufferedSamples = 0;
    for await (const frame of stream) {
      if (ending) break;
      const socket = conversation;
      // Audio before the conversation opens (the agent is still greeting) is dropped.
      if (!socket || socket.readyState !== WebSocket.OPEN) continue;
      buffered.push(frame.data);
      bufferedSamples += frame.data.length;
      if (bufferedSamples >= CHUNK_SAMPLES) {
        socket.send(JSON.stringify({ user_audio_chunk: pcmToBase64(buffered, bufferedSamples) }));
        buffered = [];
        bufferedSamples = 0;
      }
    }
  }

  function handleEvent(event: ConversationEvent): void {
    switch (event.type) {
      case "conversation_initiation_metadata": {
        const conversationId = event.conversation_initiation_metadata_event?.conversation_id;
        if (!conversationId) break;
        api
          .registerConversation(interviewId, conversationId)
          .then(() => scope.info("conversation started", { conversationId }))
          .catch((error: unknown) => void fail(`registering the conversation failed: ${String(error)}`));
        break;
      }
      case "audio": {
        const audio = event.audio_event?.audio_base_64;
        if (audio) playback?.enqueue(audio);
        break;
      }
      case "interruption":
        playback?.clear();
        break;
      case "user_transcript": {
        const text = event.user_transcription_event?.user_transcript?.trim();
        if (text) events.push({ type: "user_transcript", text });
        break;
      }
      case "agent_response": {
        const text = event.agent_response_event?.agent_response?.trim();
        if (text) events.push({ type: "agent_response", text });
        break;
      }
      case "agent_response_correction": {
        const text = event.agent_response_correction_event?.corrected_agent_response?.trim();
        if (text) events.push({ type: "agent_correction", text });
        break;
      }
      case "ping":
        conversation?.send(JSON.stringify({ type: "pong", event_id: event.ping_event?.event_id }));
        break;
    }
  }

  // Listen before connecting so an interviewee track that's already published isn't missed.
  ctx.room.on(
    RoomEvent.TrackSubscribed,
    (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (participant.identity === INTERVIEWEE_IDENTITY && track.kind === TrackKind.KIND_AUDIO) {
        void forwardInterviewee(track);
      }
    },
  );
  ctx.room.on(RoomEvent.Disconnected, () => {
    if (!ending) ctx.shutdown("room closed");
  });

  await ctx.connect(undefined, AutoSubscribe.AUDIO_ONLY);
  await ctx.waitForParticipant(INTERVIEWEE_IDENTITY);
  scope.info("interviewee present");

  const source = new AudioSource(OUTPUT_SAMPLE_RATE, 1);
  const voice = LocalAudioTrack.createAudioTrack("agent-voice", source);
  await ctx.room.localParticipant?.publishTrack(
    voice,
    new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
  );
  playback = new Playback(source);

  try {
    const session = await api.getSession(interviewId);
    const signedUrl = await signedConversationUrl(env.ELEVENLABS_API_KEY, env.ELEVENLABS_SPEECH_ENGINE_ID);

    const socket = new WebSocket(signedUrl);
    conversation = socket;
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          type: "conversation_initiation_client_data",
          conversation_config_override: { agent: { first_message: session.openingLine } },
        }),
      );
    });
    socket.on("message", (data) => {
      try {
        handleEvent(JSON.parse(data.toString()) as ConversationEvent);
      } catch (error) {
        scope.error("unreadable conversation event", { error: String(error) });
      }
    });
    socket.on("close", (code, reason) => {
      if (!ending) void fail(`ElevenLabs conversation closed (${code} ${reason.toString()})`);
    });
    socket.on("error", (error) => {
      if (!ending) void fail(`ElevenLabs connection error: ${error.message}`);
    });
  } catch (error) {
    await fail(`starting the conversation failed: ${String(error)}`);
  }
}
