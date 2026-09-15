import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssessmentFields } from "@/components/clients/assessment-fields";
import { ContactFields } from "@/components/clients/contact-fields";
import { OrganizationFields } from "@/components/clients/organization-fields";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { FormDialog } from "@/components/forms/form-dialog";
import { InterviewTable, INTERVIEW_SUMMARY_COLUMNS } from "@/components/interviews/interview-table";
import { BreadcrumbLabel } from "@/components/shell/breadcrumb-label";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { must } from "@/lib/supabase/must";
import { createUserClient } from "@/lib/supabase/server";

import {
  createAssessment,
  createContact,
  deleteContact,
  setOrganizationActive,
  updateContact,
  updateOrganization,
} from "../actions";

export const metadata: Metadata = { title: "Client" };

/** Client detail (spec §11.6): contacts (the interview pool), assessments, interview history, notes. */
export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const db = createUserClient(admin.id);
  const [organizationResult, contactsResult, assessmentsResult, interviewsResult] = await Promise.all([
    db.from("organizations").select("*").eq("id", id).maybeSingle(),
    db.from("contacts").select("*").eq("organization_id", id).order("full_name"),
    db
      .from("assessments")
      .select("id, name, description, started_on, created_at, interviews(status, department)")
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("interviews")
      .select(INTERVIEW_SUMMARY_COLUMNS)
      .eq("organization_id", id)
      .order("scheduled_at", { ascending: false, nullsFirst: false }),
  ]);

  if (organizationResult.error) throw new Error(`Client: ${organizationResult.error.message}`);
  const organization = organizationResult.data;
  if (!organization) notFound();

  const contacts = must(contactsResult, "Contacts");
  const assessments = must(assessmentsResult, "Assessments");
  const interviews = must(interviewsResult, "Interviews");
  const location = [organization.city, organization.state].filter(Boolean).join(", ");

  const contactsTab = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-fg-muted">The people NuAIg can interview at this client.</p>
        <FormDialog
          triggerLabel="Add contact"
          triggerVariant="secondary"
          triggerSize="sm"
          title="Add contact"
          action={createContact.bind(null, id)}
          submitLabel="Add contact"
        >
          <ContactFields />
        </FormDialog>
      </div>
      {contacts.length === 0 ? (
        <EmptyState message="No contacts yet. Add the staff members you plan to interview." />
      ) : (
        <Table>
          <caption className="sr-only">Contacts</caption>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Job title</TH>
              <TH>Department</TH>
              <TH>Email</TH>
              <TH align="right">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {contacts.map((contact) => (
              <TR key={contact.id}>
                <TD className="font-medium">{contact.full_name}</TD>
                <TD className="text-fg-muted">{contact.job_title ?? "—"}</TD>
                <TD className="text-fg-muted">{contact.department}</TD>
                <TD className="text-fg-muted">{contact.email ?? "—"}</TD>
                <TD align="right">
                  <div className="flex justify-end gap-1">
                    <FormDialog
                      triggerLabel="Edit"
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Edit contact"
                      action={updateContact.bind(null, contact.id, id)}
                    >
                      <ContactFields contact={contact} />
                    </FormDialog>
                    <ConfirmAction
                      triggerLabel="Remove"
                      triggerVariant="ghost"
                      title={`Remove ${contact.full_name}?`}
                      description="They’ll no longer be available as an interviewee. Contacts who already have an interview can’t be removed."
                      confirmLabel="Remove contact"
                      destructive
                      action={deleteContact.bind(null, contact.id, id)}
                    />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );

  const assessmentsTab = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-fg-muted">Engagements with this client. Interviews are scheduled within one.</p>
        <FormDialog
          triggerLabel="New assessment"
          triggerVariant="secondary"
          triggerSize="sm"
          title="New assessment"
          action={createAssessment.bind(null, id)}
          submitLabel="Create assessment"
        >
          <AssessmentFields />
        </FormDialog>
      </div>
      {assessments.length === 0 ? (
        <EmptyState message="No assessments yet. Create one before scheduling interviews." />
      ) : (
        <Table>
          <caption className="sr-only">Assessments</caption>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH align="right">Started</TH>
              <TH>Departments</TH>
              <TH>Progress</TH>
            </tr>
          </THead>
          <TBody>
            {assessments.map((assessment) => {
              const departments = [...new Set(assessment.interviews.map((interview) => interview.department))];
              const completed = assessment.interviews.filter((interview) => interview.status === "completed").length;
              return (
                <TR key={assessment.id}>
                  <TD>
                    <Link
                      href={`/assessments/${assessment.id}`}
                      className="rounded-sm font-medium text-fg hover:text-brand-700 hover:underline"
                    >
                      {assessment.name}
                    </Link>
                  </TD>
                  <TD align="right" className="text-fg-muted">
                    {assessment.started_on ? <LocalTime iso={`${assessment.started_on}T12:00:00`} format="date" /> : "—"}
                  </TD>
                  <TD className="text-fg-muted">{departments.join(", ") || "—"}</TD>
                  <TD>
                    <Progress
                      value={completed}
                      max={assessment.interviews.length}
                      label={`${assessment.name}: interviews completed`}
                    />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );

  const interviewsTab =
    interviews.length === 0 ? (
      <EmptyState message="No interviews scheduled with this client yet." />
    ) : (
      <InterviewTable interviews={interviews} caption="Interview history" showJoin />
    );

  return (
    <>
      <BreadcrumbLabel segment={id} label={organization.name} />
      <PageHeader
        title={organization.name}
        description={[organization.type, location].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {!organization.is_active && <Badge tone="muted">Inactive</Badge>}
            <FormDialog
              triggerLabel="Edit"
              triggerVariant="secondary"
              title="Edit client"
              action={updateOrganization.bind(null, id)}
            >
              <OrganizationFields organization={organization} />
            </FormDialog>
            {organization.is_active ? (
              <ConfirmAction
                triggerLabel="Deactivate"
                triggerSize="md"
                title={`Deactivate ${organization.name}?`}
                description="The client is hidden when scheduling new interviews. Existing interviews, transcripts and links are unaffected."
                confirmLabel="Deactivate client"
                action={setOrganizationActive.bind(null, id, false)}
              />
            ) : (
              <ConfirmAction
                triggerLabel="Reactivate"
                triggerSize="md"
                title={`Reactivate ${organization.name}?`}
                description="The client becomes available for scheduling again."
                confirmLabel="Reactivate client"
                action={setOrganizationActive.bind(null, id, true)}
              />
            )}
            {organization.is_active && (
              <ButtonLink href={`/interviews/new?client=${id}`}>Schedule interview</ButtonLink>
            )}
          </>
        }
      />

      {organization.notes && (
        <Card className="mb-6">
          <CardBody>
            <p className="text-xs font-medium text-fg-muted">Notes</p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-fg">{organization.notes}</p>
          </CardBody>
        </Card>
      )}

      <Tabs
        label="Client details"
        items={[
          { id: "contacts", label: `Contacts (${contacts.length})`, content: contactsTab },
          { id: "assessments", label: `Assessments (${assessments.length})`, content: assessmentsTab },
          { id: "interviews", label: `Interviews (${interviews.length})`, content: interviewsTab },
        ]}
      />
    </>
  );
}
