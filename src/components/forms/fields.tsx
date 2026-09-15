"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import { useFieldError } from "./form-state";

type FieldProps = {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Error key to display when it differs from `name` (e.g. a visible input feeding a hidden field). */
  errorName?: string;
};

function useFieldWiring(name: string, hint: ReactNode, id?: string) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const error = useFieldError(name);
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return { fieldId, error, describedBy };
}

/** Text input wired to the surrounding form's validation errors (by `name`). */
export function TextField({
  name,
  label,
  hint,
  id,
  errorName,
  ...props
}: FieldProps & Omit<ComponentProps<"input">, "name">) {
  const { fieldId, error, describedBy } = useFieldWiring(errorName ?? name, hint, id);
  return (
    <Field id={fieldId} label={label} hint={hint} error={error}>
      <Input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
    </Field>
  );
}

export function TextareaField({
  name,
  label,
  hint,
  id,
  ...props
}: FieldProps & Omit<ComponentProps<"textarea">, "name">) {
  const { fieldId, error, describedBy } = useFieldWiring(name, hint, id);
  return (
    <Field id={fieldId} label={label} hint={hint} error={error}>
      <Textarea
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  id,
  children,
  ...props
}: FieldProps & Omit<ComponentProps<"select">, "name">) {
  const { fieldId, error, describedBy } = useFieldWiring(name, hint, id);
  return (
    <Field id={fieldId} label={label} hint={hint} error={error}>
      <Select
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      >
        {children}
      </Select>
    </Field>
  );
}
