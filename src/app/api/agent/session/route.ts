import { z } from "zod";

import { isWorkerRequest } from "@/lib/agent/auth";
import { openingLine } from "@/lib/agent/script";
import { jsonNoStore, problem } from "@/lib/http";
import { isJoinable, recordPresence } from "@/lib/interviews/call";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  interviewId: z.uuid(),
  /** Omitted when the worker first asks for context; sent once ElevenLabs assigns a conversation. */
  conversationId: z.string().min(1).max(200).optional(),
});

/**
 * The worker starts (and then registers) its ElevenLabs conversation for an interview.
 * Registering maps the conversation id back to the interview for /api/agent/turn and marks
 * the agent as present.
 */
export async function POST(request: Request) {
  if (!isWorkerRequest(request)) return problem(401, "Unauthorized.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return problem(400, "Invalid request.");

  const db = createAdminClient();
  const { data: interview, error } = await db
    .from("interviews")
    .select("id, title, department, status, organizations(name), contacts(full_name)")
    .eq("id", body.data.interviewId)
    .maybeSingle();
  if (error) throw new Error(`Agent session: ${error.message.slice(0, 200)}`);
  if (!interview) return problem(404, "Interview not found.");
  if (!isJoinable(interview.status)) return problem(409, "This interview isn’t running.");

  if (body.data.conversationId) {
    const { error: updateError } = await db
      .from("interviews")
      .update({ elevenlabs_conversation_id: body.data.conversationId })
      .eq("id", interview.id);
    if (updateError) throw new Error(`Agent session: ${updateError.message.slice(0, 200)}`);
    await recordPresence(interview.id, { role: "agent" }, true);
  }

  return jsonNoStore({
    title: interview.title,
    department: interview.department,
    organizationName: interview.organizations?.name ?? null,
    intervieweeName: interview.contacts?.full_name ?? null,
    openingLine: openingLine(),
  });
}
