import type { Metadata } from "next";

export const metadata: Metadata = { title: "Interview complete" };

export default function JoinEndedPage() {
  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-6 shadow-panel sm:p-8">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">Thank you</h1>
      <p className="text-sm text-fg-muted">Your interview is complete. You can close this window.</p>
    </div>
  );
}
