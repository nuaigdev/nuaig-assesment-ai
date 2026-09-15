import { cn } from "@/lib/cn";
import type { InterviewStatus } from "@/lib/supabase/types";

const STATUS = {
  scheduled: { label: "Scheduled", className: "bg-surface-sunken text-fg" },
  ready: { label: "Ready", className: "bg-brand-050 text-brand-700" },
  live: { label: "Live", className: "bg-live-050 text-live-600" },
  completed: { label: "Completed", className: "bg-ok-050 text-ok-700" },
  cancelled: { label: "Cancelled", className: "bg-surface-sunken text-fg-muted" },
  failed: { label: "Failed", className: "bg-surface-sunken text-fg-muted" },
} satisfies Record<InterviewStatus, { label: string; className: string }>;

export function StatusPill({ status }: { status: InterviewStatus }) {
  const { label, className } = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {status === "live" && (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-live animate-live-pulse motion-reduce:animate-none"
        />
      )}
      {label}
    </span>
  );
}
