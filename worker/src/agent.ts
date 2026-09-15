import { defineAgent, type JobContext } from "@livekit/agents";

import { runBridge } from "./bridge.js";

/** Loaded in each job process: one job per dispatched interview. */
export default defineAgent({
  entry: async (ctx: JobContext) => {
    await runBridge(ctx);
  },
});
