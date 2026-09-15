import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SpeakerRole } from "@/lib/supabase/types";

function describe(error: { message: string }) {
  return error.message.replace(/\s+/g, " ").slice(0, 200);
}

export async function appendTranscriptEntry(
  interviewId: string,
  speaker: SpeakerRole,
  content: string,
  isFinal = true,
): Promise<string> {
  const { data, error } = await createAdminClient().rpc("append_transcript_entry", {
    p_interview_id: interviewId,
    p_speaker: speaker,
    p_content: content,
    p_is_final: isFinal,
  });
  if (error) throw new Error(`Appending transcript: ${describe(error)}`);
  return data;
}

async function latestAgentEntry(interviewId: string, onlyInterim: boolean) {
  let query = createAdminClient()
    .from("transcript_entries")
    .select("id")
    .eq("interview_id", interviewId)
    .eq("speaker", "agent")
    .order("seq", { ascending: false })
    .limit(1);
  if (onlyInterim) query = query.eq("is_final", false);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Reading transcript: ${describe(error)}`);
  return data;
}

async function updateEntry(entryId: string, content: string, isFinal: boolean) {
  const { error } = await createAdminClient().rpc("update_transcript_entry", {
    p_entry_id: entryId,
    p_content: content,
    p_is_final: isFinal,
  });
  if (error) throw new Error(`Updating transcript: ${describe(error)}`);
}

/**
 * The agent finished speaking a response. The brain already wrote it as an interim line
 * when it produced the text; this finalizes that line (or appends one if there wasn't one).
 */
export async function finalizeAgentResponse(interviewId: string, content: string): Promise<void> {
  const interim = await latestAgentEntry(interviewId, true);
  if (interim) await updateEntry(interim.id, content, true);
  else await appendTranscriptEntry(interviewId, "agent", content, true);
}

/** The interviewee interrupted: store what the agent actually said before being cut off. */
export async function correctAgentResponse(interviewId: string, content: string): Promise<void> {
  const latest = await latestAgentEntry(interviewId, false);
  if (latest) await updateEntry(latest.id, content, true);
}
