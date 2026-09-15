import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-sm border border-border bg-surface px-3 text-sm text-fg " +
  "transition-colors duration-150 ease-out placeholder:text-fg-muted " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-muted " +
  "aria-invalid:border-live-600";

export const controlClasses = `${controlBase} h-9`;

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-20 py-2 leading-normal", className)} {...props} />;
}

/**
 * Label + control + hint/error. Point the control's `aria-describedby` at
 * `${id}-hint` or `${id}-error`.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-live-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-[13px] text-fg-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
