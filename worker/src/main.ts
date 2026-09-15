import { extname } from "node:path";
import { fileURLToPath } from "node:url";

import { ServerOptions, cli } from "@livekit/agents";

import { AppApi } from "./app-api.js";
import { startBrainServer } from "./brain.js";
import { AGENT_IDENTITY, AGENT_NAME } from "./constants.js";
import { loadWorkerEnv } from "./env.js";

const env = loadWorkerEnv();

// agent.ts in development (tsx), agent.js once built.
const extension = extname(fileURLToPath(import.meta.url));
const agentPath = fileURLToPath(new URL(`./agent${extension}`, import.meta.url));

// The brain server runs in this main process only; job processes load agent.ts, not this file.
startBrainServer({
  port: env.PORT,
  apiKey: env.ELEVENLABS_API_KEY,
  engineId: env.ELEVENLABS_SPEECH_ENGINE_ID,
  api: new AppApi(env.APP_URL, env.AGENT_WORKER_SECRET),
});

cli.runApp(
  new ServerOptions({
    agent: agentPath,
    // Explicit dispatch only: the app sends the agent when the interviewee joins (spec §6.1).
    agentName: AGENT_NAME,
    wsURL: env.LIVEKIT_URL,
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
    port: env.HEALTH_PORT,
    requestFunc: async (request) => {
      await request.accept("NuAIg interviewer", AGENT_IDENTITY, "", { role: "agent" });
    },
  }),
);
