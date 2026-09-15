import { defineAgent, type JobContext } from "@livekit/agents";

/**
 * Loaded in each job process: one job per dispatched interview. The bridge (ElevenLabs SDK,
 * WebSocket client) is imported only when a job actually runs, so starting a process — which
 * the SDK times — loads as little as possible.
 */
export default defineAgent({
  entry: async (ctx: JobContext) => {
    const { runBridge } = await import("./bridge.js");
    await runBridge(ctx);
  },
});
