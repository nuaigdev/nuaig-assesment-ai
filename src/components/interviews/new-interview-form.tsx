"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { SelectField, TextField } from "@/components/forms/fields";
import { FormMessage, FormStateContext, useFieldError } from "@/components/forms/form-state";
import { Button, ButtonLink } from "@/components/ui/button";
import { IDLE, type ActionState } from "@/lib/actions";
import { DEPARTMENTS } from "@/lib/constants";

import { TeamPicker, type StaffOption } from "./team-picker";

type OrganizationOption = { id: string; name: string };
type AssessmentOption = { id: string; name: string; organization_id: string };
type ContactOption = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string;
  organization_id: string;
};
type TemplateOption = { id: string; name: string; department: string; version: number };

/** A datetime-local value is in the viewer's timezone; the server receives UTC ISO. */
function toIso(local: string): string {
  if (!local) return "";
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

const linkClasses = "font-medium text-brand-700 underline underline-offset-2";

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-base font-semibold text-fg">
      {children}
    </h2>
  );
}

/** Single-column scheduling form (spec §11.4): client → assessment → interviewee → department → template → time → team. */
export function NewInterviewForm({
  organizations,
  assessments,
  contacts,
  templates,
  staff,
  defaultOrganizationId,
  defaultAssessmentId,
  action,
}: {
  organizations: OrganizationOption[];
  assessments: AssessmentOption[];
  contacts: ContactOption[];
  templates: TemplateOption[];
  staff: StaffOption[];
  defaultOrganizationId: string;
  defaultAssessmentId: string;
  action: (state: unknown, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, IDLE);
  const departmentsId = useId();

  const firstAssessmentFor = (organizationId: string) =>
    assessments.find((assessment) => assessment.organization_id === organizationId)?.id ?? "";

  const [organizationId, setOrganizationId] = useState(defaultOrganizationId);
  const [assessmentId, setAssessmentId] = useState(
    () => defaultAssessmentId || firstAssessmentFor(defaultOrganizationId),
  );
  const [contactId, setContactId] = useState("");
  const [department, setDepartment] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const scheduledError = useFieldError("scheduled_at");

  const clientAssessments = assessments.filter((assessment) => assessment.organization_id === organizationId);
  const clientContacts = contacts.filter((contact) => contact.organization_id === organizationId);

  function changeOrganization(value: string) {
    setOrganizationId(value);
    setAssessmentId(firstAssessmentFor(value));
    setContactId("");
  }

  function changeContact(value: string) {
    setContactId(value);
    const contact = contacts.find((option) => option.id === value);
    if (contact) setDepartment(contact.department);
  }

  return (
    <FormStateContext.Provider value={state}>
      <form action={formAction} className="space-y-8 px-6 py-6">
        <FormMessage />

        <section className="space-y-4" aria-labelledby="schedule-who">
          <SectionHeading id="schedule-who">Who</SectionHeading>
          <SelectField
            name="organization_id"
            label="Client"
            value={organizationId}
            onChange={(event) => changeOrganization(event.target.value)}
            required
          >
            <option value="" disabled>
              Choose a client
            </option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            name="assessment_id"
            label="Assessment"
            value={assessmentId}
            onChange={(event) => setAssessmentId(event.target.value)}
            disabled={!organizationId || clientAssessments.length === 0}
            required
            hint={
              organizationId && clientAssessments.length === 0 ? (
                <>
                  This client has no assessments yet.{" "}
                  <Link href={`/clients/${organizationId}`} className={linkClasses}>
                    Create one
                  </Link>
                  .
                </>
              ) : undefined
            }
          >
            <option value="" disabled>
              {organizationId ? "Choose an assessment" : "Choose a client first"}
            </option>
            {clientAssessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            name="contact_id"
            label="Interviewee"
            value={contactId}
            onChange={(event) => changeContact(event.target.value)}
            disabled={!organizationId || clientContacts.length === 0}
            required
            hint={
              organizationId && clientContacts.length === 0 ? (
                <>
                  This client has no contacts yet.{" "}
                  <Link href={`/clients/${organizationId}`} className={linkClasses}>
                    Add one
                  </Link>
                  .
                </>
              ) : undefined
            }
          >
            <option value="" disabled>
              {organizationId ? "Choose the interviewee" : "Choose a client first"}
            </option>
            {clientContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.full_name}
                {contact.job_title ? ` · ${contact.job_title}` : ""}
              </option>
            ))}
          </SelectField>

          <TextField
            name="department"
            label="Department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            list={departmentsId}
            required
            maxLength={80}
            hint="Filled in from the interviewee; change it if this interview covers a different department."
          />
          <datalist id={departmentsId}>
            {DEPARTMENTS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </section>

        <section className="space-y-4" aria-labelledby="schedule-what">
          <SectionHeading id="schedule-what">What</SectionHeading>
          <SelectField
            name="template_id"
            label="Template (optional)"
            defaultValue=""
            disabled={templates.length === 0}
            hint={templates.length === 0 ? "No published templates yet. Templates arrive in Phase 4." : undefined}
          >
            <option value="">{templates.length === 0 ? "No templates available" : "No template"}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · {template.department} · v{template.version}
              </option>
            ))}
          </SelectField>
        </section>

        <section className="space-y-4" aria-labelledby="schedule-when">
          <SectionHeading id="schedule-when">When</SectionHeading>
          <TextField
            name="scheduled_local"
            errorName="scheduled_at"
            type="datetime-local"
            label="Date and time"
            value={scheduledLocal}
            onChange={(event) => setScheduledLocal(event.target.value)}
            required
            hint={scheduledError ? undefined : "In your timezone."}
          />
          <input type="hidden" name="scheduled_at" value={toIso(scheduledLocal)} />
        </section>

        <section className="space-y-4" aria-labelledby="schedule-team">
          <SectionHeading id="schedule-team">Team</SectionHeading>
          <TeamPicker staff={staff} />
        </section>

        <div className="-mx-6 -mb-6 flex justify-end gap-2 border-t border-border px-6 py-4">
          <ButtonLink href="/interviews" variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={pending}>
            {pending ? "Scheduling…" : "Schedule interview"}
          </Button>
        </div>
      </form>
    </FormStateContext.Provider>
  );
}
