"use client";

import { InterviewTable, type InterviewSummary } from "@/components/interviews/interview-table";
import { EmptyState } from "@/components/ui/empty-state";
import { useNow } from "@/lib/hooks/use-now";

/** Filters to interviews scheduled on the viewer's local calendar day. */
export function TodaySchedule({ interviews }: { interviews: InterviewSummary[] }) {
  const now = useNow();
  if (now === null) {
    return <div aria-hidden className="h-28" />;
  }

  const today = new Date(now).toDateString();
  const todays = interviews.filter(
    (interview) =>
      interview.scheduled_at && new Date(interview.scheduled_at).toDateString() === today,
  );

  if (todays.length === 0) {
    return <EmptyState message="Nothing is scheduled for today." />;
  }
  return <InterviewTable interviews={todays} caption="Today’s schedule" showJoin />;
}
