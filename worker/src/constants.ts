/** Must match AGENT_NAME in the app (src/lib/livekit/server.ts): the app dispatches this name. */
export const AGENT_NAME = "nuaig-interviewer";
/** The call UI finds the agent by this identity. */
export const AGENT_IDENTITY = "agent";
/** The only participant whose audio is transcribed (spec §4.4: pinned identity). */
export const INTERVIEWEE_IDENTITY = "interviewee";

/** Speech Engine audio formats, set by setup-engine.ts: pcm_16000 in, pcm_24000 out. */
export const INPUT_SAMPLE_RATE = 16_000;
export const OUTPUT_SAMPLE_RATE = 24_000;
