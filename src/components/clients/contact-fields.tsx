"use client";

import { useId } from "react";

import { TextField } from "@/components/forms/fields";
import { DEPARTMENTS } from "@/lib/constants";

type ContactDefaults = {
  full_name: string;
  job_title: string | null;
  department: string;
  email: string | null;
};

export function ContactFields({ contact }: { contact?: ContactDefaults }) {
  const departmentsId = useId();
  return (
    <>
      <TextField name="full_name" label="Name" defaultValue={contact?.full_name} required maxLength={160} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          name="department"
          label="Department"
          defaultValue={contact?.department}
          required
          maxLength={80}
          list={departmentsId}
        />
        <TextField name="job_title" label="Job title (optional)" defaultValue={contact?.job_title ?? ""} maxLength={120} />
      </div>
      <datalist id={departmentsId}>
        {DEPARTMENTS.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>
      <TextField
        name="email"
        type="email"
        label="Email (optional)"
        defaultValue={contact?.email ?? ""}
        maxLength={254}
        hint="Only for your records. The join link is copied and sent by the consultant."
      />
    </>
  );
}
