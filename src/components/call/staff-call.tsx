"use client";

import { RoomContext } from "@livekit/components-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ToastProvider } from "@/components/ui/toast";
import type { InterviewStatus } from "@/lib/supabase/types";

import { CallStage } from "./call-stage";
import { useCall, type CallPhase } from "./use-call";

function lobbyMessage(phase: CallPhase): string | null {
  if (phase.name === "failed") return phase.message;
  if (phase.name !== "ended") return null;
  switch (phase.reason) {
    case "duplicate":
      return "You joined this call from another window or device, so this one was disconnected.";
    case "removed":
      return "You were disconnected from the call.";
    case "lost":
      return "The connection dropped. Rejoin when you’re ready.";
    default:
      return null;
  }
}

/** The NuAIg call view (spec §12): a lobby for the join tap, then the listen-only stage. */
export function StaffCall(props: {
  interviewId: string;
  title: string;
  status: InterviewStatus;
  role: "steward" | "observer";
  canEnd: boolean;
  intervieweeName: string | null;
}) {
  return (
    <ToastProvider placement="bottom-center">
      <StaffCallView {...props} />
    </ToastProvider>
  );
}

function StaffCallView({
  interviewId,
  title,
  status,
  role,
  canEnd,
  intervieweeName,
}: {
  interviewId: string;
  title: string;
  status: InterviewStatus;
  role: "steward" | "observer";
  canEnd: boolean;
  intervieweeName: string | null;
}) {
  const router = useRouter();
  const backHref = `/interviews/${interviewId}`;
  const { room, phase, join, leave } = useCall({
    tokenUrl: `/api/interviews/${interviewId}/token`,
    presenceUrl: `/api/interviews/${interviewId}/presence`,
    publishMicrophone: false,
  });

  useEffect(() => {
    if (phase.name === "ended" && (phase.reason === "ended" || phase.reason === "left")) {
      router.replace(backHref);
      router.refresh();
    }
  }, [phase, router, backHref]);

  async function endInterview() {
    const response = await fetch(`/api/interviews/${interviewId}/end`, { method: "POST" });
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null);
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Couldn’t end the interview.";
      throw new Error(message);
    }
    // Closing the room disconnects this client too, which navigates back to the interview.
  }

  if (room && (phase.name === "connected" || phase.name === "reconnecting")) {
    return (
      <RoomContext.Provider value={room}>
        <CallStage
          title={title}
          role={role}
          canEnd={canEnd}
          intervieweeName={intervieweeName}
          reconnecting={phase.name === "reconnecting"}
          onLeave={() => void leave()}
          onEnd={endInterview}
        />
      </RoomContext.Provider>
    );
  }

  const joinable = status === "ready" || status === "live";
  const connecting = phase.name === "connecting";
  const message = lobbyMessage(phase);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-stage-border bg-stage-raised p-6 sm:p-8">
        <Logo variant="white" height={28} />
        <div>
          <p className="text-xs font-medium text-stage-muted">Live call</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-stage-fg">{title}</h1>
        </div>

        {joinable ? (
          <p className="text-sm text-stage-muted">
            You’re joining as <strong className="font-medium text-stage-fg">{role === "steward" ? "steward" : "an observer"}</strong>.
            You’ll hear everyone but can’t be heard, and the interviewee can see that you’ve joined.
          </p>
        ) : (
          <p className="text-sm text-stage-muted">
            This call isn’t open. Generate a join link first; finished interviews can’t be rejoined.
          </p>
        )}

        {message && (
          <p role="alert" className="rounded-sm bg-warn-050 px-3 py-2 text-[13px] text-warn-700">
            {message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {joinable && (
            <Button onClick={() => join()} disabled={connecting}>
              {connecting ? "Joining…" : phase.name === "idle" ? "Join call" : "Rejoin call"}
            </Button>
          )}
          <Link
            href={backHref}
            className="inline-flex h-9 items-center rounded-sm px-4 text-sm font-medium text-stage-fg hover:bg-stage-hover"
          >
            Back to interview
          </Link>
        </div>
      </div>
    </main>
  );
}
