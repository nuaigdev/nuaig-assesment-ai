"use client";

import { Button, ButtonLink, type ButtonSize } from "@/components/ui/button";
import { useNow } from "@/lib/hooks/use-now";
import type { InterviewStatus } from "@/lib/supabase/types";

/** Joining opens this long before the scheduled time (spec §11.2). */
export const JOIN_WINDOW_MS = 10 * 60 * 1000;

const JOINABLE_STATUSES: InterviewStatus[] = ["scheduled", "ready", "live"];

export function canJoin(status: InterviewStatus, scheduledAt: string | null, now: number | null) {
  if (!JOINABLE_STATUSES.includes(status)) return false;
  if (status === "live") return true;
  if (!scheduledAt || now === null) return false;
  return new Date(scheduledAt).getTime() - now <= JOIN_WINDOW_MS;
}

export function JoinButton({
  interviewId,
  status,
  scheduledAt,
  size = "md",
  hideWhenUnavailable = false,
}: {
  interviewId: string;
  status: InterviewStatus;
  scheduledAt: string | null;
  size?: ButtonSize;
  hideWhenUnavailable?: boolean;
}) {
  const now = useNow();

  if (canJoin(status, scheduledAt, now)) {
    return (
      <ButtonLink href={`/interviews/${interviewId}/room`} size={size}>
        Join call
      </ButtonLink>
    );
  }
  if (hideWhenUnavailable || !JOINABLE_STATUSES.includes(status)) {
    return null;
  }
  return (
    <Button size={size} disabled>
      Join call
    </Button>
  );
}
