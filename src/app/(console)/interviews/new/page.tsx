import type { Metadata } from "next";

import { NewInterviewForm } from "@/components/interviews/new-interview-form";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { searchParam } from "@/lib/search";
import { must } from "@/lib/supabase/must";
import { createUserClient } from "@/lib/supabase/server";

import { createInterview } from "../actions";

export const metadata: Metadata = { title: "Schedule interview" };

/** Schedule an interview (spec §11.4). ?client= and ?assessment= preselect from other pages. */
export default async function NewInterviewPage({ searchParams }: PageProps<"/interviews/new">) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const db = createUserClient(admin.id);

  const [organizationsResult, assessmentsResult, contactsResult, templatesResult, staffResult] = await Promise.all([
    db.from("organizations").select("id, name").eq("is_active", true).order("name"),
    db.from("assessments").select("id, name, organization_id").order("created_at", { ascending: false }),
    db.from("contacts").select("id, full_name, job_title, department, organization_id").order("full_name"),
    db.from("templates").select("id, name, department, version").eq("is_published", true).order("name"),
    db.from("users").select("id, full_name, email").eq("is_active", true).order("full_name", { nullsFirst: false }),
  ]);
  const organizations = must(organizationsResult, "Clients");
  const assessments = must(assessmentsResult, "Assessments");
  const contacts = must(contactsResult, "Contacts");
  const templates = must(templatesResult, "Templates");
  const staff = must(staffResult, "Team");

  const clientParam = searchParam(params.client);
  const assessmentParam = searchParam(params.assessment);
  const defaultOrganizationId =
    isUuid(clientParam) && organizations.some((organization) => organization.id === clientParam) ? clientParam : "";
  const defaultAssessmentId =
    isUuid(assessmentParam) &&
    assessments.some(
      (assessment) => assessment.id === assessmentParam && assessment.organization_id === defaultOrganizationId,
    )
      ? assessmentParam
      : "";

  return (
    <>
      <PageHeader
        title="Schedule interview"
        description="After saving you can generate the join link to send to the interviewee."
      />
      {organizations.length === 0 ? (
        <EmptyState
          message="Add a client before scheduling an interview."
          action={<ButtonLink href="/clients">Go to clients</ButtonLink>}
        />
      ) : (
        <Card className="max-w-2xl">
          <NewInterviewForm
            organizations={organizations}
            assessments={assessments}
            contacts={contacts}
            templates={templates}
            staff={staff}
            defaultOrganizationId={defaultOrganizationId}
            defaultAssessmentId={defaultAssessmentId}
            action={createInterview}
          />
        </Card>
      )}
    </>
  );
}
