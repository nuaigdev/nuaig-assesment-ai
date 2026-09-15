import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: { default: "Assessment interview", template: "%s · NuAIg" },
  referrer: "no-referrer",
};

/** The interviewee's surface: short, calm, obviously legitimate, and mobile-first (spec §11.10). */
export default function JoinLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="px-5 py-5 sm:px-8">
        <Logo height={32} />
      </header>
      <main className="flex flex-1 justify-center px-4 pb-10 sm:items-center">
        <div className="w-full max-w-lg">{children}</div>
      </main>
      <footer className="px-5 py-4 text-center text-xs text-fg-muted">
        NuAIg LLC · AI assessment services for senior living
      </footer>
    </div>
  );
}
