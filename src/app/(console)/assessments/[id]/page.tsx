import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssessmentFields } from "@/components/clients/assessment-fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { InterviewTable, INTERVIEW_SUMMARY_COLUMNS } from "@/components/interviews/interview-table";
import { BreadcrumbLabel } from "@/components/shell/breadcrumb-label";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader, Section } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { must } from "@/lib/supabase/must";
import { createUserClient } from "@/lib/supabase/server";

import { updateAssessment } from "../../clients/actions";

export const metadata: Metadata = { title: "Assessment" };

type DepartmentSummary = { name: string; total: number; completed: number; next: string | null };

function summarizeDepartments(
  interviews: { department: string; status: string; scheduled_at: string | null }[],
): DepartmentSummary[] {
  const byName = new Map<string, DepartmentSummary>();
  for (const interview of interviews) {
    const summary = byName.get(interview.department) ?? {
      name: interview.department,
      total: 0,
      completed: 0,
      next: null,
    };
    summary.total += 1;
    if (interview.status === "completed") summary.completed += 1;
    if (
      ["scheduled", "ready", "live"].includes(interview.status) &&
      interview.scheduled_at &&
      (!summary.next || interview.scheduled_at < summary.next)
    ) {
      summary.next = interview.scheduled_at;
    }
    byName.set(interview.department, summary);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Engagement view (spec §10): departments covered, interviews, progress. Members see assigned interviews only. */
export default async function AssessmentPage({ params }: PageProps<"/assessments/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const isAdmin = user.role === "admin";

  const db = createUserClient(user.id);
  const [assessmentResult, interviewsResult] = await Promise.all([
    db
      .from("assessments")
      .select("id, name, description, started_on, organization_id, organizations(id, name)")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("interviews")
      .select(INTERVIEW_SUMMARY_COLUMNS)
      .eq("assessment_id", id)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
  ]);

  if (assessmentResult.error) throw new Error(`Assessment: ${assessmentResult.error.message}`);
  const assessment = assessmentResult.data;
  if (!assessment) notFound();

  const interviews = must(interviewsResult, "Interviews");
  const departments = summarizeDepartments(interviews);
  const completed = interviews.filter((interview) => interview.status === "completed").length;
  const clientName = assessment.organizations?.name ?? "Client";

  return (
    <>
      <BreadcrumbLabel segment={id} label={assessment.name} />
      <PageHeader
        title={assessment.name}
        description={
          <>
            {isAdmin ? (
              <Link href={`/clients/${assessment.organization_id}`} className="font-medium text-brand-700 hover:underline">
                {clientName}
              </Link>
            ) : (
              clientName
            )}
            {assessment.started_on && (
              <>
                {" · started "}
                <LocalTime iso={`${assessment.started_on}T12:00:00`} format="date" />
              </>
            )}
          </>
        }
        actions={
          isAdmin && (
            <>
              <FormDialog
                triggerLabel="Edit"
                triggerVariant="secondary"
                title="Edit assessment"
                action={updateAssessment.bind(null, id)}
              >
                <AssessmentFields assessment={assessment} />
              </FormDialog>
              <ButtonLink href={`/interviews/new?client=${assessment.organization_id}&assessment=${id}`}>
                Schedule interview
              </ButtonLink>
            </>
          )
        }
      />

      {assessment.description && (
        <p className="-mt-2 mb-6 max-w-3xl text-sm whitespace-pre-wrap text-fg-muted">{assessment.description}</p>
      )}

      <Section id="departments" title="Departments covered">
        {departments.length === 0 ? (
          <EmptyState message="No interviews yet, so no departments are covered." />
        ) : (
          <>
            <div className="mb-4">
              <Progress value={completed} max={interviews.length} label="Interviews completed across the assessment" />
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((department) => (
                <li key={department.name}>
                  <Card className="space-y-2 px-5 py-4">
                    <p className="font-medium text-fg">{department.name}</p>
                    <Progress
                      value={department.completed}
                      max={department.total}
                      label={`${department.name}: interviews completed`}
                    />
                    <p className="text-[13px] text-fg-muted">
                      {department.next ? (
                        <>
                          Next: <LocalTime iso={department.next} />
                        </>
                      ) : (
                        "Nothing upcoming"
                      )}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section id="interviews" title="Interviews">
        {interviews.length === 0 ? (
          <EmptyState message="No interviews in this assessment yet." />
        ) : (
          <InterviewTable interviews={interviews} caption="Interviews in this assessment" showJoin />
        )}
      </Section>
    </>
  );
}
