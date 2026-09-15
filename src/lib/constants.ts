import type { InterviewStatus } from "@/lib/supabase/types";

/** Departments NuAIg assesses (spec §1). Stored as free text; these are suggestions. */
export const DEPARTMENTS = [
  "Finance",
  "Admissions & Move-ins",
  "HR",
  "Operations",
  "Marketing",
  "Foundation",
] as const;

/** Organisation types (spec §7.2 examples). Stored as free text. */
export const ORGANIZATION_TYPES = [
  "CCRC",
  "Life Plan",
  "LTPAC",
  "Assisted Living",
  "Memory Care",
  "Skilled Nursing",
  "Independent Living",
] as const;

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  scheduled: "Scheduled",
  ready: "Ready",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

export const INTERVIEW_STATUSES = Object.keys(INTERVIEW_STATUS_LABELS) as InterviewStatus[];
