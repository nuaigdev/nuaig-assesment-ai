"use client";

import { TextField, TextareaField } from "@/components/forms/fields";

type AssessmentDefaults = { name: string; description: string | null; started_on: string | null };

export function AssessmentFields({ assessment }: { assessment?: AssessmentDefaults }) {
  return (
    <>
      <TextField
        name="name"
        label="Name"
        defaultValue={assessment?.name}
        required
        maxLength={160}
        placeholder="e.g. 2026 AI readiness assessment"
      />
      <TextField name="started_on" type="date" label="Start date (optional)" defaultValue={assessment?.started_on ?? ""} />
      <TextareaField
        name="description"
        label="Description (optional)"
        defaultValue={assessment?.description ?? ""}
        rows={3}
        maxLength={2000}
      />
    </>
  );
}
