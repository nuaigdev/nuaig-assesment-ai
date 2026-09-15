import type { ReactNode } from "react";

/** The call stage is its own dark, full-screen surface (spec §9.1), outside the console shell. */
export default function CallLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-stage text-stage-fg">{children}</div>;
}
