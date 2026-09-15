import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { FormDialog } from "@/components/forms/form-dialog";
import { JoinButton } from "@/components/interviews/join-button";
import { LiveTranscript } from "@/components/call/live-transcript";
import { JoinLinkPanel } from "@/components/interviews/join-link-panel";
import { TeamPicker } from "@/components/interviews/team-picker";
import { BreadcrumbLabel } from "@/components/shell/breadcrumb-label";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { auditActionLabel, describeAuditEntry } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { formatDuration } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { createUserClient } from "@/lib/supabase/server";

import { issueJoinLink, revokeJoinLink, updateInterviewTeam } from "../actions";

export const metadata: Metadata = { title: "Interview" };

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  );
}

const linkClasses = "font-medium text-brand-700 hover:underline";

/** Interview detail (spec §11.5). Admins manage the join link and team; members see what they're assigned to. */
export default async function InterviewPage({ params, searchParams }: PageProps<"/interviews/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const justCreated = (await searchParams).created === "1";
  const isAdmin = user.role === "admin";
  const db = createUserClient(user.id);

  const [interviewResult, invitationResult, activityResult, staffResult] = await Promise.all([
    db
      .from("interviews")
      .select(
        "id, title, department, status, scheduled_at, started_at, ended_at, duration_seconds, organization_id, assessment_id, organizations(name), assessments(name), contacts(full_name, job_title, email), templates(name, version), interview_participants(user_id, role, users(full_name, email))",
      )
      .eq("id", id)
      .maybeSingle(),
    isAdmin
      ? db
          .from("invitations")
          .select("created_at, expires_at, first_used_at")
          .eq("interview_id", id)
          .is("revoked_at", null)
          .maybeSingle()
      : null,
    isAdmin
      ? db
          .from("audit_log")
          .select("id, action, metadata, created_at, users(full_name, email)")
          .eq("entity_type", "interview")
          .eq("entity_id", id)
          .order("created_at", { ascending: false })
          .limit(50)
      : null,
    isAdmin
      ? db.from("users").select("id, full_name, email").eq("is_active", true).order("full_name", { nullsFirst: false })
      : null,
  ]);

  if (interviewResult.error) throw new Error(`Interview: ${interviewResult.error.message}`);
  const interview = interviewResult.data;
  if (!interview) notFound();
  for (const result of [invitationResult, activityResult, staffResult]) {
    if (result?.error) throw new Error(`Interview details: ${result.error.message}`);
  }

  const team = interview.interview_participants.flatMap((participant) =>
    participant.user_id && participant.users && (participant.role === "steward" || participant.role === "observer")
      ? [{ user_id: participant.user_id, role: participant.role, ...participant.users }]
      : [],
  );
  team.sort((a, b) => Number(b.role === "steward") - Number(a.role === "steward"));
  const teamEditable = isAdmin && (interview.status === "scheduled" || interview.status === "ready");
  const clientName = interview.organizations?.name ?? "Client";
  const intervieweeName = interview.contacts?.full_name ?? null;

  const overview = (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {isAdmin && (
          <JoinLinkPanel
            status={interview.status}
            invitation={invitationResult?.data ?? null}
            intervieweeName={intervieweeName}
            highlight={justCreated}
            issueAction={issueJoinLink.bind(null, id)}
            revokeAction={revokeJoinLink.bind(null, id)}
          />
        )}

        <Card>
          <CardHeader
            title="NuAIg team"
            description="They listen without being heard. The interviewee sees everyone who joins."
            actions={
              teamEditable && (
                <FormDialog
                  triggerLabel="Edit team"
                  triggerVariant="secondary"
                  triggerSize="sm"
                  title="Edit team"
                  action={updateInterviewTeam.bind(null, id)}
                  submitLabel="Save team"
                  successMessage="Team updated"
                >
                  <TeamPicker
                    staff={staffResult?.data ?? []}
                    defaultTeam={team.map(({ user_id, role }) => ({ user_id, role }))}
                  />
                </FormDialog>
              )
            }
          />
          {team.length === 0 ? (
            <CardBody>
              <p className="text-sm text-fg-muted">No one is assigned yet.</p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-border">
              {team.map((member) => (
                <li key={member.user_id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={member.full_name} email={member.email} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {member.full_name ?? member.email}
                        {member.user_id === user.id && (
                          <span className="ml-1.5 text-xs font-normal text-fg-muted">(you)</span>
                        )}
                      </p>
                      <p className="truncate text-[13px] text-fg-muted">{member.email}</p>
                    </div>
                  </div>
                  <Badge tone={member.role === "steward" ? "brand" : "neutral"}>
                    {member.role === "steward" ? "Steward" : "Observer"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Details" />
        <dl className="divide-y divide-border px-5">
          <DetailRow label="Client">
            {isAdmin ? (
              <Link href={`/clients/${interview.organization_id}`} className={linkClasses}>
                {clientName}
              </Link>
            ) : (
              clientName
            )}
          </DetailRow>
          <DetailRow label="Assessment">
            <Link href={`/assessments/${interview.assessment_id}`} className={linkClasses}>
              {interview.assessments?.name ?? "Assessment"}
            </Link>
          </DetailRow>
          <DetailRow label="Interviewee">
            {intervieweeName ?? "Not set"}
            {interview.contacts?.job_title && (
              <span className="text-fg-muted"> · {interview.contacts.job_title}</span>
            )}
          </DetailRow>
          <DetailRow label="Department">{interview.department}</DetailRow>
          <DetailRow label="Template">
            {interview.templates ? `${interview.templates.name} · v${interview.templates.version}` : "None yet"}
          </DetailRow>
          <DetailRow label="Scheduled">
            {interview.scheduled_at ? <LocalTime iso={interview.scheduled_at} /> : "Not scheduled"}
          </DetailRow>
          {interview.duration_seconds !== null && (
            <DetailRow label="Duration">{formatDuration(interview.duration_seconds)}</DetailRow>
          )}
        </dl>
      </Card>
    </div>
  );

  const activity = activityResult?.data ?? [];
  const notStarted = interview.status === "scheduled" || interview.status === "ready";
  const tabs: TabItem[] = [
    { id: "overview", label: "Overview", content: overview },
    {
      id: "transcript",
      label: "Transcript",
      content: (
        <Card>
          <CardHeader
            title="Transcript"
            description={
              interview.status === "live"
                ? "Updating live while the call is in progress."
                : "Everything the interviewee and the AI interviewer said, in order. Export arrives in Phase 4."
            }
          />
          <CardBody className="h-[60vh] min-h-72">
            <LiveTranscript
              interviewId={interview.id}
              intervieweeName={intervieweeName}
              appearance="console"
              emptyMessage={
                notStarted
                  ? "The transcript appears here once the interview starts."
                  : "Nothing was transcribed for this interview."
              }
            />
          </CardBody>
        </Card>
      ),
    },
    {
      id: "recording",
      label: "Recording",
      content: <EmptyState message="Recordings arrive in Phase 6." />,
    },
  ];
  if (isAdmin) {
    tabs.push({
      id: "activity",
      label: "Activity",
      content:
        activity.length === 0 ? (
          <EmptyState message="No activity recorded yet." />
        ) : (
          <ol className="divide-y divide-border rounded-md border border-border bg-surface">
            {activity.map((entry) => {
              const detail = describeAuditEntry(entry.action, entry.metadata);
              return (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{auditActionLabel(entry.action)}</p>
                    {detail && <p className="text-[13px] text-fg-muted">{detail}</p>}
                  </div>
                  <p className="text-[13px] text-fg-muted">
                    {entry.users?.full_name ?? entry.users?.email ?? "System"}
                    {" · "}
                    <LocalTime iso={entry.created_at} />
                  </p>
                </li>
              );
            })}
          </ol>
        ),
    });
  }

  return (
    <>
      <BreadcrumbLabel segment={id} label={interview.title} />
      <PageHeader
        title={interview.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill status={interview.status} />
            <span>
              {interview.scheduled_at ? <LocalTime iso={interview.scheduled_at} /> : "Not scheduled"}
              {intervieweeName && ` · ${intervieweeName}`}
            </span>
          </span>
        }
        actions={
          (interview.status === "ready" || interview.status === "live") && (
            <JoinButton interviewId={interview.id} status={interview.status} scheduledAt={interview.scheduled_at} />
          )
        }
      />
      {/* Once an interview is complete, its transcript is what people come for (spec §11.5). */}
      <Tabs label="Interview" items={tabs} defaultTabId={interview.status === "completed" ? "transcript" : "overview"} />
    </>
  );
}
