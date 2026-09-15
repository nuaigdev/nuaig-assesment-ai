// Helpers for the db:* scripts. They talk to the hosted Supabase project through the
// Management API (https://api.supabase.com), so no Docker, DB password or local Supabase.
// Requires SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN in .env.local (or the environment).

export function loadEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Fall back to variables already in the environment (e.g. CI).
  }
  const ref = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) {
    fail("Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN in .env.local.");
  }
  return { ref, token };
}

export function managementApi({ ref, token }) {
  async function call(path, { method = "GET", body } = {}) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!response.ok) {
      const message = typeof data === "object" && data?.message ? data.message : text;
      throw new Error(`${method} ${path} failed (${response.status}): ${message}`);
    }
    return data;
  }

  return {
    call,
    /** Runs SQL as the project's postgres role. `parameters` bind to $1, $2, ... */
    query: (query, parameters) =>
      call("/database/query", { method: "POST", body: { query, parameters } }),
  };
}

const SENTINEL = "NUAIG_ROLLBACK:";

/**
 * Runs SQL inside a transaction that is always rolled back, by ending it with an exception.
 * Resolves with the text of `resultExpression` (a SQL expression evaluated just before rollback).
 * Any real SQL error rejects with that error instead.
 */
export async function runRolledBack(api, sql, resultExpression = "'ok'") {
  try {
    await api.query(
      `begin;\n${sql}\ndo $nuaig_sentinel$ begin raise exception '${SENTINEL}%', ${resultExpression}; end $nuaig_sentinel$;`,
    );
  } catch (error) {
    const match = String(error.message).match(/NUAIG_ROLLBACK:([\s\S]*?)\nCONTEXT:/);
    if (match) return match[1];
    throw error;
  }
  throw new Error("Rolled-back run finished without reaching its sentinel; check the SQL for COMMIT.");
}

export function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** Runs an async main, printing errors without a stack trace. */
export function run(main) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
