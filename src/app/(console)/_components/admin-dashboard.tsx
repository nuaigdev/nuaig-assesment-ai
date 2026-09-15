import Link from "next/link";

import {
  INTERVIEW_SUMMARY_COLUMNS,
  InterviewTable,
  type InterviewSummary,
} from "@/components/interviews/interview-table";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader, Section } from "@/components/ui/page-header";
import { must, mustCount } from "@/lib/supabase/must";
import { createUserClient } from "@/lib/supabase/server";

import { TodaySchedule } from "./today-schedule";

const HOUR_MS = 60 * 60 * 1000;

function queryWindows(now: Date) {
  return {
    // Today is decided in the viewer's timezone (TodaySchedule), so fetch a window around it.
    windowStart: new Date(now.getTime() - 24 * HOUR_MS).toISOString(),
    windowEnd: new Date(now.getTime() + 48 * HOUR_MS).toISOString(),
    // Month boundary in UTC; close enough for a counter.
    monthStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
  };
}

async function loadDashboard(userId: string) {
  const supabase = createUserClient(userId);
  const { windowStart, windowEnd, monthStart } = queryWindows(new Date());

  return Promise.all([
    supabase
      .from("interviews")
      .select(INTERVIEW_SUMMARY_COLUMNS)
      .eq("status", "live")
      .order("started_at"),
    supabase
      .from("interviews")
      .select(INTERVIEW_SUMMARY_COLUMNS)
      .gte("scheduled_at", windowStart)
      .lt("scheduled_at", windowEnd)
      .order("scheduled_at"),
    supabase
      .from("interviews")
      .select(INTERVIEW_SUMMARY_COLUMNS)
      .in("status", ["completed", "cancelled", "failed"])
      .order("ended_at", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", monthStart),
    supabase.from("recordings").select("duration_seconds"),
    supabase.from("templates").select("id", { count: "exact", head: true }),
  ]);
}

/** Admin dashboard (spec §11.2): live now, today, recent, four counters. */
export async function AdminDashboard({ userId }: { userId: string }) {
  const [live, upcoming, recent, activeClients, interviewsThisMonth, recordings, templates] =
    await loadDashboard(userId);

  const liveInterviews: InterviewSummary[] = must(live, "Live interviews");
  const recordedSeconds = must(recordings, "Recordings").reduce(
    (total, recording) => total + (recording.duration_seconds ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={<ButtonLink href="/interviews/new">Schedule interview</ButtonLink>}
      />

      {liveInterviews.length > 0 && (
        <section
          aria-labelledby="live-now"
          className="mb-8 rounded-md border border-border bg-surface px-5 py-4 shadow-panel"
        >
          <h2 id="live-now" className="flex items-center gap-2 text-base font-semibold text-fg">
            <span
              aria-hidden
              className="size-2 rounded-full bg-live animate-live-pulse motion-reduce:animate-none"
            />
            Live now
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {liveInterviews.map((interview) => (
              <li key={interview.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <Link
                    href={`/interviews/${interview.id}`}
                    className="rounded-sm font-medium text-fg hover:underline"
                  >
                    {interview.organizations?.name ?? interview.title} — {interview.department}
                  </Link>
                  <p className="text-[13px] text-fg-muted">
                    {interview.contacts?.full_name ?? "Interviewee"}
                    {interview.started_at && (
                      <>
                        {" · started "}
                        <LocalTime iso={interview.started_at} format="time" />
                      </>
                    )}
                  </p>
                </div>
                <ButtonLink href={`/interviews/${interview.id}/room`} variant="secondary" size="sm">
                  Join call
                </ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Section id="today" title="Today’s schedule">
        <TodaySchedule interviews={must(upcoming, "Scheduled interviews")} />
      </Section>

      <Section id="recent" title="Recent interviews">
        {must(recent, "Recent interviews").length > 0 ? (
          <InterviewTable interviews={must(recent, "Recent interviews")} caption="Recent interviews" />
        ) : (
          <EmptyState message="Completed interviews will appear here." />
        )}
      </Section>

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Counter label="Active clients" value={mustCount(activeClients, "Active clients")} />
        <Counter
          label="Interviews this month"
          value={mustCount(interviewsThisMonth, "Interviews this month")}
        />
        <Counter label="Hours recorded" value={(recordedSeconds / 3600).toFixed(1)} />
        <Counter label="Templates" value={mustCount(templates, "Templates")} />
      </section>
    </>
  );
}

function Counter({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-fg tabular-nums">{value}</p>
    </Card>
  );
}
