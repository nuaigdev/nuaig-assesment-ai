import Link from "next/link";

import { AvatarStack } from "@/components/ui/avatar-stack";
import { LocalTime } from "@/components/ui/local-time";
import { StatusPill } from "@/components/ui/status-pill";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDuration } from "@/lib/format";
import type { InterviewStatus, ParticipantRole } from "@/lib/supabase/types";

import { JoinButton } from "./join-button";

/** Select string matching InterviewSummary (without participants). */
export const INTERVIEW_SUMMARY_COLUMNS =
  "id, title, department, status, scheduled_at, started_at, duration_seconds, organizations(name), contacts(full_name)";

export type InterviewSummary = {
  id: string;
  title: string;
  department: string;
  status: InterviewStatus;
  scheduled_at: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  organizations: { name: string } | null;
  contacts: { full_name: string } | null;
  interview_participants?: {
    role: ParticipantRole;
    users?: { full_name: string | null; email: string } | null;
  }[];
};

/** The interviews table (spec §11.3). */
export function InterviewTable({
  interviews,
  caption,
  showJoin = false,
  showParticipants = false,
}: {
  interviews: InterviewSummary[];
  caption: string;
  showJoin?: boolean;
  showParticipants?: boolean;
}) {
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <THead>
        <tr>
          <TH>Status</TH>
          <TH>Client</TH>
          <TH>Department</TH>
          <TH>Interviewee</TH>
          <TH align="right">Scheduled</TH>
          <TH align="right">Duration</TH>
          {showParticipants && <TH>Team</TH>}
          {showJoin && (
            <TH align="right">
              <span className="sr-only">Actions</span>
            </TH>
          )}
        </tr>
      </THead>
      <TBody>
        {interviews.map((interview) => (
          <TR key={interview.id}>
            <TD>
              <StatusPill status={interview.status} />
            </TD>
            <TD>
              <Link
                href={`/interviews/${interview.id}`}
                className="rounded-sm font-medium text-fg hover:text-brand-700 hover:underline"
              >
                {interview.organizations?.name ?? interview.title}
              </Link>
            </TD>
            <TD className="text-fg-muted">{interview.department}</TD>
            <TD className="text-fg-muted">{interview.contacts?.full_name ?? "—"}</TD>
            <TD align="right" className="text-fg-muted">
              {interview.scheduled_at ? <LocalTime iso={interview.scheduled_at} /> : "—"}
            </TD>
            <TD align="right" className="text-fg-muted">
              {formatDuration(interview.duration_seconds)}
            </TD>
            {showParticipants && (
              <TD>
                <AvatarStack
                  people={(interview.interview_participants ?? []).flatMap((participant) =>
                    participant.users ? [participant.users] : [],
                  )}
                />
              </TD>
            )}
            {showJoin && (
              <TD align="right">
                <JoinButton
                  interviewId={interview.id}
                  status={interview.status}
                  scheduledAt={interview.scheduled_at}
                  size="sm"
                  hideWhenUnavailable
                />
              </TD>
            )}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
