"use client";

import { useId, useState } from "react";

import { useFieldError } from "@/components/forms/form-state";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export type StaffOption = { id: string; full_name: string | null; email: string };
export type TeamAssignment = { user_id: string; role: "steward" | "observer" };

type Choice = "none" | TeamAssignment["role"];

const CHOICES: { value: Choice; label: string }[] = [
  { value: "none", label: "Not assigned" },
  { value: "observer", label: "Observer" },
  { value: "steward", label: "Steward" },
];

/**
 * Assign NuAIg staff as steward or observer (spec §11.4). One steward per interview:
 * choosing a new steward turns the previous one into an observer. Submits a JSON `team` field.
 */
export function TeamPicker({
  staff,
  defaultTeam = [],
  name = "team",
}: {
  staff: StaffOption[];
  defaultTeam?: TeamAssignment[];
  name?: string;
}) {
  const baseId = useId();
  const error = useFieldError(name);
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(defaultTeam.map((member) => [member.user_id, member.role])),
  );

  function choose(userId: string, choice: Choice) {
    setChoices((current) => {
      const next = { ...current };
      if (choice === "steward") {
        for (const [id, value] of Object.entries(next)) {
          if (value === "steward") next[id] = "observer";
        }
      }
      next[userId] = choice;
      return next;
    });
  }

  const team: TeamAssignment[] = Object.entries(choices).flatMap(([user_id, choice]) =>
    choice === "none" ? [] : [{ user_id, role: choice }],
  );

  return (
    <fieldset className="space-y-2" aria-describedby={`${baseId}-hint`}>
      <legend className="text-xs font-medium text-fg">NuAIg team</legend>
      <p id={`${baseId}-hint`} className="text-[13px] text-fg-muted">
        Everyone listens without being heard. The steward can also steer the agent. One steward per
        interview.
      </p>
      <input type="hidden" name={name} value={JSON.stringify(team)} />

      {staff.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[13px] text-fg-muted">
          No active team members yet. Invite them from Team.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {staff.map((person) => {
            const current = choices[person.id] ?? "none";
            const displayName = person.full_name ?? person.email;
            return (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={person.full_name} email={person.email} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{displayName}</p>
                    {person.full_name && <p className="truncate text-xs text-fg-muted">{person.email}</p>}
                  </div>
                </div>
                <div
                  role="radiogroup"
                  aria-label={`Role for ${displayName}`}
                  className="inline-flex rounded-sm border border-border p-0.5"
                >
                  {CHOICES.map((choice) => (
                    <label
                      key={choice.value}
                      className={cn(
                        "cursor-pointer rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                        "has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-brand",
                        current === choice.value
                          ? "bg-brand-050 text-brand-700"
                          : "text-fg-muted hover:text-fg",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${baseId}-${person.id}`}
                        value={choice.value}
                        checked={current === choice.value}
                        onChange={() => choose(person.id, choice.value)}
                        className="sr-only"
                      />
                      {choice.label}
                    </label>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-[13px] text-live-600">{error}</p>}
    </fieldset>
  );
}
