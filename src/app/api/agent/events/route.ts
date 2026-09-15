import { z } from "zod";

import { isWorkerRequest } from "@/lib/agent/auth";
import {
  appendTranscriptEntry,
  correctAgentResponse,
  finalizeAgentResponse,
} from "@/lib/agent/transcript";
import { problem } from "@/lib/http";
import { recordPresence, teardownInterview } from "@/lib/interviews/call";
import { createAdminClient } from "@/lib/supabase/admin";

const text = z.string().trim().max(20_000);

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("user_transcript"), text }),
  z.object({ type: z.literal("agent_response"), text }),
  z.object({ type: z.literal("agent_correction"), text }),
  z.object({ type: z.literal("agent_left") }),
  z.object({ type: z.literal("failed"), message: z.string().max(500) }),
]);

const bodySchema = z.object({
  interviewId: z.uuid(),
  events: z.array(eventSchema).min(1).max(50),
});

/**
 * Ordered events from the worker's ElevenLabs conversation: what the interviewee said, what
 * the agent said (or was cut off saying), the agent leaving, and worker failures.
 * Transcript lines are only accepted while the call is live.
 */
export async function POST(request: Request) {
  if (!isWorkerRequest(request)) return problem(401, "Unauthorized.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return problem(400, "Invalid request.");

  const { interviewId, events } = body.data;
  const { data: interview, error } = await createAdminClient()
    .from("interviews")
    .select("status")
    .eq("id", interviewId)
    .maybeSingle();
  if (error) throw new Error(`Agent events: ${error.message.slice(0, 200)}`);
  if (!interview) return problem(404, "Interview not found.");
  const live = interview.status === "live";

  for (const event of events) {
    switch (event.type) {
      case "user_transcript":
        if (live && event.text) await appendTranscriptEntry(interviewId, "interviewee", event.text);
        break;
      case "agent_response":
        if (live && event.text) await finalizeAgentResponse(interviewId, event.text);
        break;
      case "agent_correction":
        if (live && event.text) await correctAgentResponse(interviewId, event.text);
        break;
      case "agent_left":
        await recordPresence(interviewId, { role: "agent" }, false);
        break;
      case "failed":
        // Spec §14 Phase 3: a worker crash marks the interview failed, through the one teardown.
        console.error(`Agent worker failed for interview ${interviewId}: ${event.message}`);
        await teardownInterview(interviewId, "error", { failed: true });
        break;
    }
  }

  return new Response(null, { status: 204 });
}
