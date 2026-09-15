import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env/server";

/**
 * /api/agent/* is called by the agent worker, never a browser (spec §10.1). It authenticates
 * with `Authorization: Bearer <AGENT_WORKER_SECRET>`, compared in constant time.
 */
export function isWorkerRequest(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!provided) return false;
  const expected = createHash("sha256").update(env.AGENT_WORKER_SECRET).digest();
  const actual = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expected, actual);
}
