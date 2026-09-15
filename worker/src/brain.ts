import { createServer, type Server } from "node:http";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import type { AppApi } from "./app-api.js";
import { log } from "./log.js";

/**
 * The brain endpoint ElevenLabs Speech Engine connects to (configured as the engine's wsUrl).
 * For every finished interviewee turn it asks the app for the agent's next line and streams it
 * back. The SDK verifies ElevenLabs' signed JWT on each connection. Also serves /healthz.
 */
export function startBrainServer({
  port,
  apiKey,
  engineId,
  api,
}: {
  port: number;
  apiKey: string;
  engineId: string;
  api: AppApi;
}): Server {
  const server = createServer((request, response) => {
    if (request.url === "/healthz") {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("ok");
      return;
    }
    response.writeHead(404);
    response.end();
  });

  new ElevenLabsClient({ apiKey }).speechEngine.attach(engineId, server, "/brain", {
    onInit(conversationId) {
      log.info("brain connected", { conversationId });
    },
    async onTranscript(transcript, signal, session) {
      const conversationId = session.conversationId;
      if (!conversationId) return;
      try {
        const { text } = await api.nextTurn(conversationId, transcript);
        // A newer turn (the interviewee kept talking) aborts this one; don't speak a stale reply.
        if (text && !signal.aborted) await session.sendResponse(text);
      } catch (error) {
        if (!signal.aborted) log.error("turn failed", { conversationId, error: String(error) });
      }
    },
    onError(error) {
      log.error("brain error", { error: error.message });
    },
  });

  server.listen(port, () => log.info("brain listening", { port, path: "/brain" }));
  return server;
}
