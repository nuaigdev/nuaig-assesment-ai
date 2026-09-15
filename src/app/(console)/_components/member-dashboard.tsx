import { JoinButton } from "@/components/interviews/join-button";
import {
  INTERVIEW_SUMMARY_COLUMNS,
  InterviewTable,
  type InterviewSummary,
} from "@/components/interviews/interview-table";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader, Section } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import type { ParticipantRole } from "@/lib/supabase/types";
import { must } from "@/lib/supabase/must";
import { createUserClient } from "@/lib/supabase/server";

/** Member dashboard (spec §11.2): next interview, then upcoming and recent. RLS scopes to assigned. */
export async function MemberDashboard({ userId }: { userId: string }) {
  const supabase = createUserClient(userId);

  const [upcomingResult, recentResult] = await Promise.all([
    supabase
      .from("interviews")
      .select(
        "id, title, department, status, scheduled_at, started_at, duration_seconds, organizations(name), contacts(full_name), interview_participants(user_id, role)",
      )
      .in("status", ["scheduled", "ready", "live"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(10),
    supabase
      .from("interviews")
      .select(INTERVIEW_SUMMARY_COLUMNS)
      .in("status", ["completed", "cancelled", "failed"])
      .order("ended_at", { ascending: false, nullsFirst: false })
      .limit(5),
  ]);

  // A call already in progress outranks anything merely scheduled.
  const upcoming = [...must(upcomingResult, "Upcoming interviews")].sort(
    (a, b) => Number(b.status === "live") - Number(a.status === "live"),
  );
  const recent: InterviewSummary[] = must(recentResult, "Recent interviews");
  const [next, ...later] = upcoming;
  const myRole = next?.interview_participants.find((p) => p.user_id === userId)?.role;

  return (
    <>
      <PageHeader title="Dashboard" />

      <Section id="next-interview" title="Your next interview">
        {next ? (
          <NextInterviewCard interview={next} role={myRole} />
        ) : (
          <EmptyState message="You have no upcoming interviews. They appear here when an admin assigns you." />
        )}
      </Section>

      {later.length > 0 && (
        <Section id="upcoming" title="Upcoming">
          <InterviewTable interviews={later} caption="Upcoming interviews" showJoin />
        </Section>
      )}

      <Section id="recent" title="Recent">
        {recent.length > 0 ? (
          <InterviewTable interviews={recent} caption="Recent interviews" />
        ) : (
          <EmptyState message="Interviews you’ve taken part in will appear here." />
        )}
      </Section>
    </>
  );
}

function NextInterviewCard({
  interview,
  role,
}: {
  interview: InterviewSummary;
  role: ParticipantRole | undefined;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-6 px-6 py-5">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <StatusPill status={interview.status} />
          {role === "steward" && <span className="text-xs font-medium text-fg-muted">Steward</span>}
          {role === "observer" && <span className="text-xs font-medium text-fg-muted">Observing</span>}
        </div>
        <p className="text-lg font-semibold tracking-[-0.01em] text-fg">
          {interview.organizations?.name ?? interview.title} — {interview.department}
        </p>
        <p className="text-[13px] text-fg-muted">
          {interview.contacts?.full_name ?? "Interviewee not set"}
          {" · "}
          {interview.scheduled_at ? <LocalTime iso={interview.scheduled_at} /> : "Not scheduled"}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <JoinButton
          interviewId={interview.id}
          status={interview.status}
          scheduledAt={interview.scheduled_at}
        />
        {interview.status !== "live" && (
          <p className="text-xs text-fg-muted">Opens 10 minutes before the start</p>
        )}
      </div>
    </Card>
  );
}
