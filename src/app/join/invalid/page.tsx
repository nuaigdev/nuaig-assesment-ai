import type { Metadata } from "next";

import { searchParam } from "@/lib/search";

export const metadata: Metadata = { title: "Link not available" };

export default async function InvalidJoinLinkPage({ searchParams }: PageProps<"/join/invalid">) {
  const rateLimited = searchParam((await searchParams).reason) === "rate_limited";

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-6 shadow-panel sm:p-8">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
        {rateLimited ? "Too many attempts" : "This link isn’t working"}
      </h1>
      <p className="text-sm text-fg-muted">
        {rateLimited
          ? "We’ve paused requests from your network for a few minutes. Please wait, then open your link again."
          : "It may have expired or been replaced by a newer link. Contact the NuAIg consultant who sent it and ask for a new one."}
      </p>
    </div>
  );
}
