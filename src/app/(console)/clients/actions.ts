"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  databaseErrorMessage,
  failure,
  invalid,
  readForm,
  success,
  type ActionState,
} from "@/lib/actions";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { createUserClient } from "@/lib/supabase/server";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .transform((value) => value || null);

const organizationSchema = z.object({
  name: z.string().trim().min(1, "Enter the organisation’s name.").max(160, "Keep it under 160 characters."),
  type: optionalText(40),
  city: optionalText(80),
  state: optionalText(40),
  notes: optionalText(4000),
});
const ORGANIZATION_FIELDS = ["name", "type", "city", "state", "notes"] as const;

const contactSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the contact’s name.").max(160, "Keep it under 160 characters."),
  job_title: optionalText(120),
  department: z.string().trim().min(1, "Enter their department.").max(80, "Keep it under 80 characters."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address.")
    .transform((value) => value || null),
});
const CONTACT_FIELDS = ["full_name", "job_title", "department", "email"] as const;

const assessmentSchema = z.object({
  name: z.string().trim().min(1, "Name the assessment.").max(160, "Keep it under 160 characters."),
  description: optionalText(2000),
  started_on: z
    .string()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a valid date.")
    .transform((value) => value || null),
});
const ASSESSMENT_FIELDS = ["name", "description", "started_on"] as const;

function slugify(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "client";
}

function revalidateClient(organizationId: string) {
  revalidatePath("/clients");
  revalidatePath(`/clients/${organizationId}`);
}

// Organisations ------------------------------------------------------------------------------

export async function createOrganization(_state: unknown, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = organizationSchema.safeParse(readForm(formData, ORGANIZATION_FIELDS));
  if (!parsed.success) return invalid(parsed.error);

  const db = createUserClient(admin.id);
  const base = slugify(parsed.data.name);
  let organizationId: string | null = null;

  // Slugs are unique; on a collision retry with a short random suffix.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 6)}`;
    const { data, error } = await db
      .from("organizations")
      .insert({ ...parsed.data, slug, created_by: admin.id })
      .select("id")
      .single();
    if (!error) {
      organizationId = data.id;
      break;
    }
    if (error.code !== "23505") return failure(databaseErrorMessage(error));
  }
  if (!organizationId) return failure("Couldn’t create this client. Try a slightly different name.");

  revalidatePath("/clients");
  redirect(`/clients/${organizationId}`);
}

export async function updateOrganization(
  organizationId: string,
  _state: unknown,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(organizationId)) return failure("Client not found.");
  const parsed = organizationSchema.safeParse(readForm(formData, ORGANIZATION_FIELDS));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await createUserClient(admin.id)
    .from("organizations")
    .update(parsed.data)
    .eq("id", organizationId);
  if (error) return failure(databaseErrorMessage(error));

  revalidateClient(organizationId);
  return success("Client updated");
}

export async function setOrganizationActive(organizationId: string, active: boolean): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(organizationId)) return failure("Client not found.");

  const { error } = await createUserClient(admin.id)
    .from("organizations")
    .update({ is_active: active === true })
    .eq("id", organizationId);
  if (error) return failure(databaseErrorMessage(error));

  revalidateClient(organizationId);
  return success(active ? "Client reactivated" : "Client deactivated");
}

// Contacts -------------------------------------------------------------------------------------

export async function createContact(
  organizationId: string,
  _state: unknown,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(organizationId)) return failure("Client not found.");
  const parsed = contactSchema.safeParse(readForm(formData, CONTACT_FIELDS));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await createUserClient(admin.id)
    .from("contacts")
    .insert({ ...parsed.data, organization_id: organizationId });
  if (error) return failure(databaseErrorMessage(error));

  revalidateClient(organizationId);
  return success("Contact added");
}

export async function updateContact(
  contactId: string,
  organizationId: string,
  _state: unknown,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(contactId) || !isUuid(organizationId)) return failure("Contact not found.");
  const parsed = contactSchema.safeParse(readForm(formData, CONTACT_FIELDS));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await createUserClient(admin.id)
    .from("contacts")
    .update(parsed.data)
    .eq("id", contactId)
    .eq("organization_id", organizationId);
  if (error) return failure(databaseErrorMessage(error));

  revalidateClient(organizationId);
  return success("Contact updated");
}

export async function deleteContact(contactId: string, organizationId: string): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(contactId) || !isUuid(organizationId)) return failure("Contact not found.");

  const { error } = await createUserClient(admin.id)
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("organization_id", organizationId);
  if (error?.code === "23503") {
    return failure("This contact is the interviewee on an interview, so they can’t be removed.");
  }
  if (error) return failure(databaseErrorMessage(error));

  revalidateClient(organizationId);
  return success("Contact removed");
}

// Assessments ----------------------------------------------------------------------------------

export async function createAssessment(
  organizationId: string,
  _state: unknown,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(organizationId)) return failure("Client not found.");
  const parsed = assessmentSchema.safeParse(readForm(formData, ASSESSMENT_FIELDS));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await createUserClient(admin.id)
    .from("assessments")
    .insert({ ...parsed.data, organization_id: organizationId, created_by: admin.id });
  if (error) return failure(databaseErrorMessage(error));

  revalidateClient(organizationId);
  return success("Assessment created");
}

export async function updateAssessment(
  assessmentId: string,
  _state: unknown,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!isUuid(assessmentId)) return failure("Assessment not found.");
  const parsed = assessmentSchema.safeParse(readForm(formData, ASSESSMENT_FIELDS));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await createUserClient(admin.id)
    .from("assessments")
    .update(parsed.data)
    .eq("id", assessmentId);
  if (error) return failure(databaseErrorMessage(error));

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath("/clients/[id]", "page");
  return success("Assessment updated");
}
