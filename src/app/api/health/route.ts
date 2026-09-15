import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Uptime check. Reaching this handler at all means env validation passed at boot;
 * the database check confirms Supabase is reachable with the service role.
 */
export async function GET() {
  const started = performance.now();

  let database: "ok" | "error" = "ok";
  try {
    const { error } = await createAdminClient()
      .from("users")
      .select("id", { head: true, count: "exact" });
    if (error) database = "error";
  } catch {
    database = "error";
  }

  const healthy = database === "ok";
  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: { env: "ok", database },
      latencyMs: Math.round(performance.now() - started),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
