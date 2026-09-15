import { z } from "zod";

import { isWorkerRequest } from "@/lib/agent/auth";
import { scriptedReply } from "@/lib/agent/script";
import { appendTranscriptEntry } from "@/lib/agent/transcript";
import { jsonNoStore, problem } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  conversationId: z.string().min(1).max(200),
  transcript: z
    .array(z.object({ role: z.enum(["user", "agent"]), content: z.string().max(20_000) }))
    .max(1000),
});

/**
 * Worker → next agent line (spec §10.1). Called by the worker's brain server each time Speech
 * Engine reports a finished interviewee turn. Phase 3 returns the fixed script; Phase 4 builds
 * the prompt and asks Claude. The line is recorded as an interim transcript entry right away,
 * and finalized when the worker reports it was spoken.
 */
export async function POST(request: Request) {
  if (!isWorkerRequest(request)) return problem(401, "Unauthorized.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return problem(400, "Invalid request.");

  const { data: interview, error } = await createAdminClient()
    .from("interviews")
    .select("id, status")
    .eq("elevenlabs_conversation_id", body.data.conversationId)
    .maybeSingle();
  if (error) throw new Error(`Agent turn: ${error.message.slice(0, 200)}`);
  // An unknown or finished conversation gets no reply, so the agent stays silent.
  if (!interview || interview.status !== "live") return jsonNoStore({ text: "" });

  const userTurns = body.data.transcript.filter((message) => message.role === "user").length;
  const text = scriptedReply(userTurns);
  await appendTranscriptEntry(interview.id, "agent", text, false);

  return jsonNoStore({ text });
}
