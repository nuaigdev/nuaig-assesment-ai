import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const TONES = {
  neutral: "bg-surface-sunken text-fg",
  muted: "bg-surface-sunken text-fg-muted",
  brand: "bg-brand-050 text-brand-700",
  ok: "bg-ok-050 text-ok-700",
  warn: "bg-warn-050 text-warn-700",
  live: "bg-live-050 text-live-600",
};

export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium whitespace-nowrap",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
