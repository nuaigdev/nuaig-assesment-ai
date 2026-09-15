import { defineAgent, type JobContext } from "@livekit/agents";

// Imported at module load on purpose. The SDK loads this file while a job process is starting,
// which is covered by INITIALIZE_PROCESS_TIMEOUT_MS. Importing later, inside `entry`, blocks the
// event loop after start-up, where the parent's health pings go unanswered and the job is dropped
// as "orphaned" on slow instances.
import { runBridge } from "./bridge.js";

/** Runs in a job process: one job per dispatched interview. */
export default defineAgent({
  entry: async (ctx: JobContext) => {
    await runBridge(ctx);
  },
});
