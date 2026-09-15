import "server-only";

import { after } from "next/server";

import { env } from "@/lib/env/server";

/**
 * Free hosting tiers (e.g. Render) spin the worker down when it gets no HTTP traffic, and any
 * request wakes it in about a minute. Pages that come before a call (the interviewee's join link,
 * the staff call lobby) call this so the worker is registered with LiveKit by the time it's
 * dispatched. Runs after the response, so it never slows the page. No-op without AGENT_WORKER_URL.
 */
export function wakeAgentWorker(): void {
  const workerUrl = env.AGENT_WORKER_URL;
  if (!workerUrl) return;
  after(async () => {
    await fetch(new URL("/healthz", workerUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  });
}
