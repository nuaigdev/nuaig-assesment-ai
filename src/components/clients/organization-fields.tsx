"use client";

import { SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { ORGANIZATION_TYPES } from "@/lib/constants";

type OrganizationDefaults = {
  name: string;
  type: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
};

export function OrganizationFields({ organization }: { organization?: OrganizationDefaults }) {
  const type = organization?.type ?? "";
  const types: readonly string[] =
    type && !ORGANIZATION_TYPES.some((option) => option === type) ? [...ORGANIZATION_TYPES, type] : ORGANIZATION_TYPES;

  return (
    <>
      <TextField
        name="name"
        label="Name"
        defaultValue={organization?.name}
        required
        maxLength={160}
        autoComplete="organization"
      />
      <SelectField name="type" label="Type (optional)" defaultValue={type}>
        <option value="">Not specified</option>
        {types.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <TextField name="city" label="City (optional)" defaultValue={organization?.city ?? ""} maxLength={80} />
        <TextField name="state" label="State (optional)" defaultValue={organization?.state ?? ""} maxLength={40} />
      </div>
      <TextareaField
        name="notes"
        label="Notes (optional)"
        defaultValue={organization?.notes ?? ""}
        rows={3}
        maxLength={4000}
      />
    </>
  );
}
