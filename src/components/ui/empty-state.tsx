import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** One line of what this is, at most one primary action. No illustrations (spec §9.5). */
export function EmptyState({
  message,
  action,
  className,
}: {
  message: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-md border border-dashed border-border bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm text-fg-muted">{message}</p>
      {action}
    </div>
  );
}
