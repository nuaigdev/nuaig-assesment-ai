"use client";

import { createClient } from "@supabase/supabase-js";
import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { publicEnv } from "@/lib/env/public";
import type { Database, SpeakerRole } from "@/lib/supabase/types";

type Entry = {
  id: string;
  seq: number;
  speaker: SpeakerRole;
  content: string;
  started_at_ms: number | null;
  is_final: boolean;
};

function formatOffset(ms: number | null) {
  const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The live transcript for NuAIg staff (spec §12.4): loads what exists, then follows Realtime
 * inserts and updates. Interim lines render muted and italic until they're final.
 */
export function LiveTranscript({
  interviewId,
  intervieweeName,
}: {
  interviewId: string;
  intervieweeName: string | null;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [following, setFollowing] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cachedToken: { value: string; expiresAt: number } | null = null;
    const accessToken = async () => {
      if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.value;
      const response = await fetch(`/api/interviews/${interviewId}/realtime-token`, { method: "POST" });
      if (!response.ok) throw new Error("Couldn’t authorize the transcript");
      const data = (await response.json()) as { token: string; expiresAt: string };
      cachedToken = { value: data.token, expiresAt: Date.parse(data.expiresAt) };
      return data.token;
    };

    const client = createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      accessToken,
    });
    let cancelled = false;

    const upsert = (entry: Entry) =>
      setEntries((current) => {
        const next = current.some((existing) => existing.id === entry.id)
          ? current.map((existing) => (existing.id === entry.id ? entry : existing))
          : [...current, entry];
        return next.sort((a, b) => a.seq - b.seq);
      });

    const channel = client
      .channel(`transcript:${interviewId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transcript_entries", filter: `interview_id=eq.${interviewId}` },
        (payload) => {
          if (payload.eventType !== "DELETE") upsert(payload.new as Entry);
        },
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus("live");
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus("error");
      });

    void client
      .from("transcript_entries")
      .select("id, seq, speaker, content, started_at_ms, is_final")
      .eq("interview_id", interviewId)
      .order("seq")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setStatus("error");
        else data.forEach(upsert);
      });

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [interviewId]);

  // Keep the newest line in view unless the reader has scrolled up (then offer "Jump to latest").
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (following && scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [entries, following]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setFollowing(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 40);
  }

  const speakerName = (speaker: SpeakerRole) =>
    speaker === "agent" ? "NuAIg interviewer" : speaker === "interviewee" ? (intervieweeName ?? "Interviewee") : "System";

  return (
    <div className="relative flex h-full flex-col">
      <div ref={scrollerRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-[13px] text-stage-muted">
            {status === "error"
              ? "The live transcript couldn’t connect. Reopen this panel to retry."
              : "The transcript appears here as the conversation happens."}
          </p>
        ) : (
          <ol aria-live="polite" aria-label="Live transcript" className="space-y-4">
            {entries.map((entry) => (
              <li key={entry.id}>
                <p className="flex items-baseline gap-2 text-xs">
                  <span className={cn("font-medium", entry.speaker === "agent" ? "text-brand" : "text-stage-fg")}>
                    {speakerName(entry.speaker)}
                  </span>
                  <span className="text-stage-muted tabular-nums">{formatOffset(entry.started_at_ms)}</span>
                </p>
                <p className={cn("mt-1 text-sm leading-relaxed", entry.is_final ? "text-stage-fg" : "text-stage-muted italic")}>
                  {entry.content}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
      {!following && entries.length > 0 && (
        <button
          type="button"
          onClick={() => setFollowing(true)}
          className="absolute bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-medium text-white shadow-float"
        >
          <ArrowDown aria-hidden className="size-3.5" />
          Jump to latest
        </button>
      )}
    </div>
  );
}
